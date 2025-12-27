import type { Milliseconds } from "../../ports/time"
import type { Clock } from "../time/clock"
import type { Sleep } from "./sleep"

export type PollUntilSuccess<T> = { ok: true; value: T }
export type PollUntilTimeoutFailure = { ok: false; reason: "timeout" }
export type PollUntilAbortFailure = { ok: false; reason: "aborted" }
export type PollUntilFailure = PollUntilTimeoutFailure | PollUntilAbortFailure
export type PollUntilResult<T> = PollUntilSuccess<T> | PollUntilFailure

export type PollOptions = {
  pollMs: Milliseconds
  timeoutMs: Milliseconds
  signal?: AbortSignal
}

export type PollDeps = {
  clock: Clock
  sleep: Sleep
}

export async function pollUntil<T>(
  fn: () => Promise<T | null>,
  deps: PollDeps,
  opts: PollOptions,
): Promise<PollUntilResult<T>> {
  if (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs < 0) {
    throw new Error(`Invalid timeoutMs: ${opts.timeoutMs}`)
  }

  if (!Number.isFinite(opts.pollMs) || opts.pollMs <= 0) {
    throw new Error(`Invalid pollMs: ${opts.pollMs}`)
  }

  const deadline = deps.clock.nowMs() + opts.timeoutMs

  while (true) {
    if (opts.signal?.aborted) return { ok: false, reason: "aborted" }
    if (deps.clock.nowMs() >= deadline) return { ok: false, reason: "timeout" }

    const result = await fn()

    if (result !== null) return { ok: true, value: result }

    await deps.sleep(opts.pollMs, opts.signal)
  }
}

export type PollUntilFn = typeof pollUntil
