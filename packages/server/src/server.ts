import type { Logger } from "@subspace/logger"
import type { Hono, Context as HonoContext, MiddlewareHandler } from "hono"
import { resolveConfig, type ServerDependencies, type ServerOptions } from "./config"
import type { RunningServer } from "./lifecycle/running"
import type { StopResult } from "./lifecycle/shutdown"
import { type SignalHandler, setupProcessHandlers } from "./lifecycle/signals"
import { type ServerState, startServer } from "./lifecycle/start"

export type Application = Hono
export type Context = HonoContext
export type Middleware = MiddlewareHandler

export interface Server {
  setupProcessHandlers(): this
  start(): Promise<RunningServer>
}

export interface Closeable {
  close: (callback?: (err?: Error | null) => void) => void
}

export function createServer(deps: ServerDependencies, options: ServerOptions): Server {
  const config = resolveConfig(deps.config)

  const { logger, clock } = deps

  let ready = false
  let state: ServerState = "idle"
  let runningServer: RunningServer | undefined
  let signalHandler: SignalHandler | undefined

  const server: Server = {
    setupProcessHandlers() {
      if (signalHandler) return server

      signalHandler = setupProcessHandlers({
        logger,
        stop: () => runningServer?.stop() ?? noopStop(logger),
      })

      return server
    },

    start() {
      return startServer({
        deps,
        options,
        config,
        logger,
        clock,

        getState: () => state,
        setState: (s) => {
          state = s
        },

        getReady: () => ready,
        setReady: (v) => {
          ready = v
        },

        setRunningServer: (s) => {
          runningServer = s
        },

        getSignalHandler: () => signalHandler,
      })
    },
  }

  return server
}

function noopStop(logger: Logger): Promise<StopResult> {
  logger.warn("Stop called but server not running")

  return Promise.resolve({ ok: true, failures: [], timedOut: false })
}
