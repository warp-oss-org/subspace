import type { Application, CreateAppFn } from "../create-server"
import type { CreateErrorHandlerFn } from "../errors/create-error-handler"
import type { CreateDefaultMiddlewareFn } from "../middleware/defaults"
import type { ResolvedServerOptions, ServerDependencies } from "../server-options"
import type { BuildAppFn } from "./build-app"
import type { CreateStopperFn, ServerHandle } from "./create-stopper"
import type { ListenFn } from "./listen"
import type { Closeable, ShutdownFn } from "./shutdown"
import type { SignalHandler } from "./signals"
import type { StartupFn } from "./startup"

export type ServerState = "idle" | "starting" | "started"

export type ServerInstance = {
  app: Application
  server: Closeable
  address: { host: string; port: number }
}

export interface StartServerCollabs {
  onStartup: StartupFn
  onShutdown: ShutdownFn

  listen: ListenFn

  buildApp: BuildAppFn
  createApp: CreateAppFn

  createStopper: CreateStopperFn
  createDefaultMiddleware: CreateDefaultMiddlewareFn
  createErrorHandler: CreateErrorHandlerFn
}

export type StartServerContext = {
  deps: ServerDependencies
  options: ResolvedServerOptions

  getState(): ServerState
  setState(state: ServerState): void

  getReady(): boolean
  setReady(value: boolean): void

  setRunningServer(server: ServerHandle): void
  getSignalHandler(): SignalHandler | undefined

  collabs: StartServerCollabs
}

export async function startServer(ctx: StartServerContext): Promise<ServerHandle> {
  if (ctx.getState() !== "idle") throw new Error("Server already started")

  ctx.setState("starting")

  try {
    await ctx.collabs.onStartup({
      clock: ctx.deps.clock,
      logger: ctx.deps.logger,
      deadlineMs: ctx.deps.clock.nowMs() + ctx.options.startupTimeoutMs,
      startHooks: ctx.options.beforeStart ?? [],
    })

    const app = ctx.collabs.buildApp({
      options: ctx.options,
      isReady: ctx.getReady,
      createApp: ctx.collabs.createApp,
      createErrorHandler: () =>
        ctx.collabs.createErrorHandler(ctx.options, ctx.deps.logger),
      defaultMiddleware: ctx.collabs.createDefaultMiddleware(
        ctx.options,
        ctx.deps.logger,
      ),
    })

    const server = ctx.collabs.listen(app, ctx.options, ctx.deps.logger)

    const running = ctx.collabs.createStopper({
      deps: ctx.deps,
      server,
      options: ctx.options,
      stopHooks: ctx.options.beforeStop ?? [],
      setReady: ctx.setReady,
      shutdown: ctx.collabs.onShutdown,
      onStop: () => ctx.getSignalHandler()?.unregister(),
    })

    ctx.setRunningServer(running)
    ctx.setReady(true)
    ctx.setState("started")

    return running
  } catch (err) {
    ctx.setState("idle")
    ctx.setReady(false)
    throw err
  }
}
