import type { Closeable } from "../create-server"
import type { ResolvedServerOptions, ServerDependencies } from "../server-options"
import type { LifecycleHook } from "./lifecycle"
import type { ShutdownFn, StopResult } from "./shutdown"

export interface ServerHandle {
  stop(): Promise<StopResult>
  address: { host: string; port: number }
}

export type OnStopFn = () => void
export type SetReadyFn = (value: boolean) => void

export interface RunningServerContext {
  server: Closeable

  deps: ServerDependencies
  options: ResolvedServerOptions

  setReady: SetReadyFn

  onStop: OnStopFn
  shutdown: ShutdownFn
  stopHooks: LifecycleHook[]
}

export function createStopper(ctx: RunningServerContext): ServerHandle {
  let stopping: Promise<StopResult> | undefined

  return {
    stop: async () => {
      if (!stopping) {
        stopping = runShutdown(ctx)
      }

      return stopping
    },
    address: {
      host: ctx.options.host,
      port: ctx.options.port,
    },
  }
}

export type CreateStopperFn = typeof createStopper

function runShutdown(ctx: RunningServerContext): Promise<StopResult> {
  ctx.setReady(false)

  return (async () => {
    try {
      return await ctx.shutdown({
        server: ctx.server,
        deps: ctx.deps,
        deadlineMs: ctx.deps.clock.nowMs() + ctx.options.shutdownTimeoutMs,
        stopHooks: ctx.stopHooks,
      })
    } finally {
      ctx.onStop()
    }
  })()
}
