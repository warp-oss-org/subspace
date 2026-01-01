import type { Clock, UnixMs } from "@subspace/clock"
import type { Logger } from "@subspace/logger"
import type { ResolvedServerConfig } from "../config"
import type { Closeable } from "../server"
import type { LifecycleHook } from "./lifecycle"
import { type StopResult, shutdown } from "./shutdown"

export interface RunningServer {
  stop(): Promise<StopResult>
  address: { host: string; port: number }
}

export interface RunningServerContext {
  nodeServer: Closeable
  clock: Clock
  logger: Logger
  config: ResolvedServerConfig
  stopHooks: LifecycleHook[]
  setReady: (value: boolean) => void
  onStop: () => void
}

export function createRunningServer(ctx: RunningServerContext): RunningServer {
  let stopping: Promise<StopResult> | undefined

  return {
    stop: async () => {
      if (!stopping) {
        stopping = runShutdown(ctx)
      }

      return stopping
    },
    address: {
      host: ctx.config.host,
      port: ctx.config.port,
    },
  }
}

function runShutdown(ctx: RunningServerContext): Promise<StopResult> {
  ctx.setReady(false)

  return (async () => {
    try {
      return await shutdown({
        server: ctx.nodeServer,
        clock: ctx.clock,
        logger: ctx.logger,
        deadlineMs: (ctx.clock.nowMs() + ctx.config.shutdownTimeoutMs) as UnixMs,
        stopHooks: ctx.stopHooks,
      })
    } finally {
      ctx.onStop()
    }
  })()
}
