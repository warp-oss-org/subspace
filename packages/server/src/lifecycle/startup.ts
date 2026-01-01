import type { Clock, UnixMs } from "@subspace/clock"
import type { Logger } from "@subspace/logger"
import type { HookFailure, LifecycleHook } from "./lifecycle"
import { runHooks } from "./run-hooks"

export type StartupContext = {
  clock: Clock
  logger: Logger
  deadlineMs: UnixMs
  startHooks: LifecycleHook[]
}

export type StartResult = { ok: boolean; failures: HookFailure[]; timedOut: boolean }

export async function startup(ctx: StartupContext): Promise<StartResult> {
  ctx.logger.debug("Running startup hooks...")

  const { failures, timedOut } = await runHooks(
    {
      phase: "startup",
      clock: ctx.clock,
      logger: ctx.logger,
      deadlineMs: ctx.deadlineMs,
    },
    ctx.startHooks,
    { failFast: true },
  )

  const ok = failures.length === 0 && !timedOut

  return { ok, failures, timedOut }
}
