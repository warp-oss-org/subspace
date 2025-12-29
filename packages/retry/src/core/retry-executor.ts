import type { Clock } from "@subspace/clock"
import type { AttemptContext, RetryAttemptInfo } from "../ports/attempt-context"
import type { RetryConfig } from "../ports/retry-config"
import type { IRetryExecutor } from "../ports/retry-executor"
import type { RetryFn } from "../ports/retry-fn"
import type { RetryResult } from "../ports/retry-result"

export type RetryExecutorDeps = {
  clock: Clock
}

export function createRetryExecutor(deps: RetryExecutorDeps): IRetryExecutor {
  return new RetryExecutor(deps)
}

type Outcome<T, E> = { done: true; result: RetryResult<T, E> } | { done: false }
type AttemptResult<T> = { ok: true; value: T } | { ok: false; error: unknown }
type SleepResult = { aborted: boolean }

class RetryExecutor implements IRetryExecutor {
  constructor(private readonly deps: RetryExecutorDeps) {}

  async execute<T, E = Error>(fn: RetryFn<T>, config: RetryConfig<T, E>): Promise<T> {
    const result = await this.run(fn, config)

    if (result.success) {
      return result.value
    }

    throw result.error
  }

  async tryExecute<T, E = Error>(
    fn: RetryFn<T>,
    config: RetryConfig<T, E>,
  ): Promise<RetryResult<T, E>> {
    return this.run(fn, config)
  }

  private async run<T, E = Error>(
    fn: RetryFn<T>,
    config: RetryConfig<T, E>,
  ): Promise<RetryResult<T, E>> {
    this.validateConfig(config)

    const { maxAttempts, observer, signal, maxElapsedMs } = config
    const startedAt = this.deps.clock.nowMs()

    if (this.isAborted(signal)) {
      const ctx = this.buildContext(0, startedAt, signal)
      await observer?.onAborted?.(ctx)
      return this.abortedResult(0, 0)
    }

    let lastError: E | undefined

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const ctx = this.buildContext(attempt, startedAt, signal)
      const isLastAttempt = attempt === maxAttempts - 1

      const guardResult = await this.checkGuardrails(
        ctx,
        lastError,
        maxElapsedMs,
        signal,
        observer,
      )
      if (guardResult) return guardResult

      await observer?.onAttempt?.(ctx)

      const attemptResult = await this.tryAttempt(fn, ctx)

      if (attemptResult.ok) {
        const outcome = await this.handleSuccess(
          attemptResult.value,
          ctx,
          isLastAttempt,
          config,
        )

        if (outcome.done) return outcome.result
        continue
      }

      lastError = attemptResult.error as E
      const outcome = await this.handleError(
        lastError,
        ctx,
        isLastAttempt,
        config,
        startedAt,
      )

      if (outcome.done) return outcome.result
    }

    assert.fail("Unreachable: retry loop must terminate via return")
  }

  private async checkGuardrails<E>(
    ctx: AttemptContext,
    lastError: E | undefined,
    maxElapsedMs: number | undefined,
    signal: AbortSignal | undefined,
    observer: RetryConfig<unknown, E>["observer"],
  ): Promise<RetryResult<never, E> | null> {
    if (this.isTimedOut(ctx.elapsedMs, maxElapsedMs)) {
      const timeoutError = lastError ?? (new Error("Retry timeout") as E)
      const info = this.buildAttemptInfo(ctx, null, true)

      await observer?.onExhausted?.(timeoutError, info)
      return this.timedOutResult(timeoutError, ctx.attempt, ctx.elapsedMs)
    }

    if (this.isAborted(signal)) {
      await observer?.onAborted?.(ctx)
      return this.abortedResult(ctx.attempt, ctx.elapsedMs)
    }

    return null
  }

  private async tryAttempt<T>(
    fn: RetryFn<T>,
    ctx: AttemptContext,
  ): Promise<AttemptResult<T>> {
    try {
      const value = await fn(ctx)
      return { ok: true, value }
    } catch (error) {
      return { ok: false, error }
    }
  }

  private async handleSuccess<T, E>(
    result: T,
    ctx: AttemptContext,
    isLastAttempt: boolean,
    config: RetryConfig<T, E>,
  ): Promise<Outcome<T, E>> {
    const { delay: delayPolicy, resultPredicate, observer, signal, maxElapsedMs } = config
    const shouldRetry = resultPredicate?.shouldRetry(result, ctx) ?? false

    if (shouldRetry && !isLastAttempt) {
      const nextDelayMs = this.getDelayMs(delayPolicy, ctx.attempt)
      const info = this.buildAttemptInfo(ctx, nextDelayMs, isLastAttempt)

      await observer?.onResultRetry?.(result, info)

      const sleepResult = await this.sleep(
        nextDelayMs,
        signal,
        maxElapsedMs,
        ctx.startedAt,
      )
      if (sleepResult.aborted) {
        return this.handleSleepAborted(ctx, observer)
      }

      return { done: false }
    }

    await observer?.onSuccess?.(result, ctx)
    return {
      done: true,
      result: this.successResult<T, E>(result, ctx.attempt + 1, ctx.startedAt),
    }
  }

  private async handleError<T, E>(
    error: E,
    ctx: AttemptContext,
    isLastAttempt: boolean,
    config: RetryConfig<T, E>,
    startedAt: number,
  ): Promise<Outcome<T, E>> {
    const { delay: delayPolicy, errorPredicate, observer, signal, maxElapsedMs } = config
    const shouldRetry =
      (errorPredicate?.shouldRetry(error, ctx) ?? true) && !isLastAttempt

    if (shouldRetry) {
      const nextDelayMs = this.getDelayMs(delayPolicy, ctx.attempt)
      const info = this.buildAttemptInfo(ctx, nextDelayMs, isLastAttempt)

      await observer?.onError?.(error, info)

      const sleepResult = await this.sleep(nextDelayMs, signal, maxElapsedMs, startedAt)
      if (sleepResult.aborted) {
        return this.handleSleepAborted(ctx, observer)
      }

      return { done: false }
    }

    const info = this.buildAttemptInfo(ctx, null, true)
    await observer?.onExhausted?.(error, info)

    return {
      done: true,
      result: this.exhaustedResult<T, E>(error, ctx.attempt + 1, startedAt),
    }
  }

  private async handleSleepAborted<T, E>(
    ctx: AttemptContext,
    observer: RetryConfig<T, E>["observer"],
  ): Promise<Outcome<T, E>> {
    const abortCtx = this.buildContext(ctx.attempt + 1, ctx.startedAt, ctx.signal)
    await observer?.onAborted?.(abortCtx)

    return {
      done: true,
      result: this.abortedResult(ctx.attempt + 1, abortCtx.elapsedMs),
    }
  }

  private validateConfig(config: RetryConfig<unknown, unknown>): void {
    if (!Number.isInteger(config.maxAttempts) || config.maxAttempts < 1) {
      throw new RangeError(
        `maxAttempts must be an integer >= 1 (got ${config.maxAttempts})`,
      )
    }

    if (config.maxElapsedMs !== undefined) {
      if (!Number.isFinite(config.maxElapsedMs) || config.maxElapsedMs < 0) {
        throw new RangeError(
          `maxElapsedMs must be a finite number >= 0 (got ${config.maxElapsedMs})`,
        )
      }
    }
  }

  private isAborted(signal: AbortSignal | undefined): boolean {
    return signal?.aborted ?? false
  }

  private isTimedOut(elapsedMs: number, maxElapsedMs?: number): boolean {
    return maxElapsedMs !== undefined && elapsedMs >= maxElapsedMs
  }

  private getDelayMs(
    delay: RetryConfig<unknown, unknown>["delay"],
    attempt: number,
  ): number {
    return delay.getDelay(attempt).milliseconds
  }

  private buildContext(
    attempt: number,
    startedAt: number,
    signal?: AbortSignal,
  ): AttemptContext {
    return {
      attempt,
      attemptsSoFar: attempt + 1,
      startedAt,
      elapsedMs: this.deps.clock.nowMs() - startedAt,
      ...(signal && { signal }),
    }
  }

  private buildAttemptInfo(
    ctx: AttemptContext,
    nextDelayMs: number | null,
    isLastAttempt: boolean,
  ): RetryAttemptInfo {
    return {
      ...ctx,
      nextDelayMs,
      isLastAttempt,
    }
  }

  private async sleep(
    delayMs: number,
    signal: AbortSignal | undefined,
    maxElapsedMs: number | undefined,
    startedAt: number,
  ): Promise<SleepResult> {
    const actualDelay = this.clampDelay(delayMs, maxElapsedMs, startedAt)

    if (actualDelay <= 0) return { aborted: false }

    try {
      await this.deps.clock.sleep(actualDelay, signal)
      return { aborted: false }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return { aborted: true }
      }
      throw error
    }
  }

  private clampDelay(
    delayMs: number,
    maxElapsedMs: number | undefined,
    startedAt: number,
  ): number {
    if (maxElapsedMs === undefined) return delayMs

    const elapsed = this.deps.clock.nowMs() - startedAt
    const remaining = maxElapsedMs - elapsed
    return Math.min(delayMs, Math.max(0, remaining))
  }

  private successResult<T, E = never>(
    value: T,
    attempts: number,
    startedAt: number,
  ): RetryResult<T, E> {
    return {
      success: true,
      value,
      attempts,
      elapsedMs: this.deps.clock.nowMs() - startedAt,
    }
  }

  private abortedResult<E>(attempts: number, elapsedMs: number): RetryResult<never, E> {
    return {
      success: false,
      error: new DOMException("Aborted", "AbortError") as E,
      attempts,
      elapsedMs,
      aborted: true,
      timedOut: false,
    }
  }

  private timedOutResult<T = never, E = Error>(
    error: E,
    attempts: number,
    elapsedMs: number,
  ): RetryResult<T, E> {
    return {
      success: false,
      error,
      attempts,
      elapsedMs,
      aborted: false,
      timedOut: true,
    }
  }

  private exhaustedResult<T = never, E = Error>(
    error: E,
    attempts: number,
    startedAt: number,
  ): RetryResult<T, E> {
    return {
      success: false,
      error,
      attempts,
      elapsedMs: this.deps.clock.nowMs() - startedAt,
      aborted: false,
      timedOut: false,
    }
  }
}
