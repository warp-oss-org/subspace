import {
  type Handler,
  Hono,
  type Context as HonoContext,
  type MiddlewareHandler,
} from "hono"
import {
  type CreateErrorHandlerFn,
  createErrorHandler,
} from "../errors/create-error-handler"
import { type BuildAppFn, buildApp } from "../lifecycle/build-app"
import {
  type CreateStopperFn,
  createStopper,
  type ServerHandle,
} from "../lifecycle/create-stopper"
import { type ListenFn, listen } from "../lifecycle/listen"
import { type ShutdownFn, shutdown } from "../lifecycle/shutdown"
import {
  type SetupProcessHandlersFn,
  type SignalHandler,
  setupProcessHandlers,
} from "../lifecycle/signals"
import { type StartupFn, startup } from "../lifecycle/startup"
import {
  type CreateDefaultMiddlewareFn,
  createDefaultMiddleware,
} from "../middleware/create-default-middleware"
import {
  type ResolvedServerOptions,
  resolveOptions,
  type ServerDependencies,
  type ServerOptions,
} from "./server-options"

export type Application = Hono
export type Router = Hono
export type Context = HonoContext
export type Middleware = MiddlewareHandler
export type RequestHandler = Handler
export type ServerState = "idle" | "starting" | "started"

export interface ServerCollaborators {
  onStartup: StartupFn
  onShutdown: ShutdownFn
  listen: ListenFn
  buildApp: BuildAppFn
  createStopper: CreateStopperFn
  setupProcessHandlers: SetupProcessHandlersFn
  createDefaultMiddleware: CreateDefaultMiddlewareFn
  createErrorHandler: CreateErrorHandlerFn
}

const defaultCollaborators: ServerCollaborators = {
  onStartup: startup,
  onShutdown: shutdown,
  listen,
  buildApp,
  createStopper,
  setupProcessHandlers,
  createDefaultMiddleware,
  createErrorHandler,
}

export function createApp(): Application {
  return new Hono()
}

export function createRouter(): Router {
  return new Hono()
}

export type CreateAppFn = typeof createApp

export class Server {
  readonly app: Application

  private state: ServerState = "idle"
  private ready = false
  private runningServer?: ServerHandle
  private signalHandler?: SignalHandler

  constructor(
    private readonly deps: ServerDependencies,
    private readonly options: ResolvedServerOptions,
    private readonly collabs: ServerCollaborators = defaultCollaborators,
  ) {
    this.app = options.createApp()
  }

  setupProcessHandlers(): this {
    if (this.signalHandler) return this

    this.signalHandler = this.collabs.setupProcessHandlers({
      logger: this.deps.logger,
      stop: () => this.runningServer?.stop() ?? this.noopStop(),
    })

    return this
  }

  async start(): Promise<ServerHandle> {
    if (this.state !== "idle") {
      throw new Error("Server already started")
    }

    this.state = "starting"

    try {
      await this.collabs.onStartup({
        clock: this.deps.clock,
        logger: this.deps.logger,
        deadlineMs: this.deps.clock.nowMs() + this.options.startupTimeoutMs,
        startHooks: this.options.startHooks,
      })

      const app = this.collabs.buildApp({
        options: this.options,
        isReady: () => this.ready,
        createApp: () => this.app,
        createErrorHandler: () =>
          this.collabs.createErrorHandler(this.options, this.deps.logger),
        defaultMiddleware: this.collabs.createDefaultMiddleware(
          this.options,
          this.deps.logger,
        ),
      })

      const server = this.collabs.listen(app, this.options, this.deps.logger)

      const handle = this.collabs.createStopper({
        deps: this.deps,
        server,
        options: this.options,
        stopHooks: this.options.stopHooks,
        setReady: (v) => {
          this.ready = v
        },
        shutdown: this.collabs.onShutdown,
        onStop: () => this.signalHandler?.unregister(),
      })

      this.runningServer = handle
      this.ready = true
      this.state = "started"

      return handle
    } catch (err) {
      this.state = "idle"
      this.ready = false

      throw err
    }
  }

  getState(): ServerState {
    return this.state
  }

  isReady(): boolean {
    return this.ready
  }

  private noopStop(): Promise<{ ok: true; failures: []; timedOut: false }> {
    this.deps.logger.warn("Stop called but server not running")

    return Promise.resolve({ ok: true, failures: [], timedOut: false })
  }
}

export function createServer(deps: ServerDependencies, options: ServerOptions): Server {
  return new Server(deps, resolveOptions(options))
}
