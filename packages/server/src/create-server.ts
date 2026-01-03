import type { Logger } from "@subspace/logger"
import { Hono, type Context as HonoContext, type MiddlewareHandler } from "hono"
import { createErrorHandler } from "./errors/create-error-handler"
import { buildApp } from "./lifecycle/build-app"
import { createStopper, type ServerHandle } from "./lifecycle/create-stopper"
import { listen } from "./lifecycle/listen"
import { type StopResult, shutdown } from "./lifecycle/shutdown"
import { type SignalHandler, setupProcessHandlers } from "./lifecycle/signals"
import { type ServerState, startServer } from "./lifecycle/start-server"
import { startup } from "./lifecycle/startup"
import { createDefaultMiddleware } from "./middleware/create-default-middleware"
import {
  resolveOptions,
  type ServerDependencies,
  type ServerOptions,
} from "./server-options"

export type Application = Hono
export type Context = HonoContext
export type Middleware = MiddlewareHandler

export interface Server {
  setupProcessHandlers(): this
  start(): Promise<ServerHandle>
}

export interface Closeable {
  close: (callback?: (err?: Error | null) => void) => void
}

export type ServerInstance = {
  app: Application
  server: Closeable
  address: { host: string; port: number }
}

export function createApp(): Application {
  return new Hono()
}

export type CreateAppFn = typeof createApp

export function createServer(deps: ServerDependencies, options: ServerOptions): Server {
  const resolvedOptions = resolveOptions(options)

  const { logger } = deps

  let ready = false
  let state: ServerState = "idle"
  let runningServer: ServerHandle | undefined
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
        collabs: {
          onStartup: startup,
          onShutdown: shutdown,

          listen,

          createApp: () => new Hono(),

          createStopper,
          createErrorHandler,

          buildApp,
          createDefaultMiddleware,
        },

        deps,
        options: resolvedOptions,

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
