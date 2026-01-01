import type { Clock, UnixMs } from "@subspace/clock"
import type { Logger } from "@subspace/logger"
import type { HookFailure, LifecycleHook } from "./lifecycle"
import { runHooks } from "./run-hooks"

export interface Closeable {
  close: (callback?: (err?: Error | null) => void) => void
}

export type ShutdownContext = {
  server: Closeable
  clock: Clock
  logger: Logger
  deadlineMs: UnixMs
  stopHooks: LifecycleHook[]
}

/**
 * Result of graceful shutdown attempt.
 */
export type StopResult = {
  /** True if shutdown completed cleanly (no failures, no timeout). */
  ok: boolean

  /** Hooks that threw during shutdown. */
  failures: HookFailure[]

  /**
   * True if shutdown deadline was reached before completion.
   * This means either server.close() or hooks were skipped/aborted.
   * Does NOT imply sockets were force-killed (we don't track sockets).
   */
  timedOut: boolean
}

export async function shutdown(ctx: ShutdownContext): Promise<StopResult> {
  ctx.logger.warn("Shutting down gracefully...")

  const hooks: LifecycleHook[] = [createCloseServerHook(ctx.server), ...ctx.stopHooks]

  const { failures, timedOut } = await runHooks(
    {
      phase: "shutdown",
      clock: ctx.clock,
      logger: ctx.logger,
      deadlineMs: ctx.deadlineMs,
    },
    hooks,
    { failFast: false },
  )

  const ok = failures.length === 0 && !timedOut

  ctx.logger.info("Shutdown complete")

  return { ok, failures, timedOut }
}

function createCloseServerHook(server: Closeable): LifecycleHook {
  return {
    name: "server.close",
    fn: async ({ signal }) => {
      const res = await closeServerUntilAborted(server, signal)

      if (res.aborted) return
      if (res.error) throw res.error
    },
  }
}

function closeServerOnce(server: Closeable): Promise<{ error?: unknown }> {
  return new Promise((resolve) => {
    server.close((err) => resolve({ error: err ?? undefined }))
  })
}

const ABORTED = Symbol("aborted")

type CloseUntilAbortedResult = { aborted: true } | { aborted: false; error?: unknown }

async function closeServerUntilAborted(
  server: Closeable,
  signal: AbortSignal,
): Promise<CloseUntilAbortedResult> {
  if (signal.aborted) return { aborted: true }

  let onAbort: (() => void) | undefined

  const abortedPromise = new Promise<typeof ABORTED>((resolve) => {
    onAbort = () => resolve(ABORTED)
    signal.addEventListener("abort", onAbort, { once: true })
  })

  try {
    const res = await Promise.race([closeServerOnce(server), abortedPromise])

    if (res === ABORTED) return { aborted: true }

    return { aborted: false, error: res.error }
  } finally {
    if (onAbort) signal.removeEventListener("abort", onAbort)
  }
}
