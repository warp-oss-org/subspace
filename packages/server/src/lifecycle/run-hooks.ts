import type { Clock, UnixMs } from "@subspace/clock"
import type { Logger } from "@subspace/logger"
import type { HookFailure, LifecycleHook } from "./lifecycle-hook"

export type HookPhase = "startup" | "shutdown"

export type RunHooksContext = {
  phase: HookPhase
  clock: Clock
  logger: Logger
  deadlineMs: UnixMs
}

export type RunHooksPolicy = {
  /** If true, stop after first failure. (Typical for startup) */
  failFast?: boolean
}

export async function runHooks(
  ctx: RunHooksContext,
  hooks: LifecycleHook[],
  policy: RunHooksPolicy = {},
): Promise<{ failures: HookFailure[]; timedOut: boolean }> {
  const failures: HookFailure[] = []

  for (const hook of hooks) {
    const attempt = await runOneHook(ctx, hook)

    if (attempt.failure) {
      failures.push(attempt.failure)
      if (policy.failFast) return { failures, timedOut: attempt.timedOut }
    }

    if (attempt.timedOut) return { failures, timedOut: true }
  }

  return { failures, timedOut: false }
}

async function runOneHook(
  ctx: RunHooksContext,
  hook: LifecycleHook,
): Promise<{ failure?: HookFailure; timedOut: boolean }> {
  const msLeft = timeLeftMs(ctx)

  if (msLeft <= 0) {
    ctx.logger.warn(`Skipping remaining ${ctx.phase} hooks due to timeout`)
    return { timedOut: true }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), msLeft)

  try {
    await hook.fn({ signal: controller.signal, timeRemainingMs: msLeft })

    if (didHitDeadline(ctx, controller)) {
      ctx.logger.warn(
        `${capitalize(ctx.phase)} deadline exceeded during hook: ${hook.name}`,
      )
      return { timedOut: true }
    }

    ctx.logger.info(`Executed ${ctx.phase} hook: ${hook.name}`)

    return { timedOut: false }
  } catch (err) {
    ctx.logger.error(`${capitalize(ctx.phase)} hook failed: ${hook.name}`, { err })

    const failure: HookFailure = { hook: hook.name, error: err }

    if (didHitDeadline(ctx, controller)) {
      ctx.logger.warn(
        `${capitalize(ctx.phase)} deadline exceeded during hook failure: ${hook.name}`,
      )
      return { failure, timedOut: true }
    }

    return { failure, timedOut: false }
  } finally {
    clearTimeout(timeoutId)
  }
}

function didHitDeadline(ctx: RunHooksContext, controller: AbortController): boolean {
  return controller.signal.aborted || ctx.clock.nowMs() >= ctx.deadlineMs
}

function timeLeftMs(ctx: RunHooksContext): number {
  return Math.max(0, ctx.deadlineMs - ctx.clock.nowMs())
}

function capitalize(s: string): string {
  return s.length ? s[0]?.toUpperCase() + s.slice(1) : s
}
