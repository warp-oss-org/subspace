import type { Clock } from "@subspace/clock"
import type { Logger } from "@subspace/logger"
import type { resolveConfig, ServerDependencies, ServerOptions } from "../config"
import { bindServer } from "./bind"
import { buildApp } from "./build"
import { createRunningServer, type RunningServer } from "./running"
import type { SignalHandler } from "./signals"
import { startup } from "./startup"

export type ServerState = "idle" | "starting" | "started"

export interface StartServerContext {
  deps: ServerDependencies
  options: ServerOptions
  config: ReturnType<typeof resolveConfig>
  logger: Logger
  clock: Clock

  getState(): ServerState
  setState(state: ServerState): void

  getReady(): boolean
  setReady(value: boolean): void

  setRunningServer(server: RunningServer): void
  getSignalHandler(): SignalHandler | undefined
}

export async function startServer(ctx: StartServerContext): Promise<RunningServer> {
  if (ctx.getState() !== "idle") {
    throw new Error("Server already started")
  }

  ctx.setState("starting")

  try {
    await startup({
      clock: ctx.clock,
      logger: ctx.logger,
      deadlineMs: ctx.clock.nowMs() + ctx.config.startupTimeoutMs,
      startHooks: ctx.options.beforeStart ?? [],
    })

    const app = buildApp({
      config: ctx.config,
      options: ctx.options,
      logger: ctx.logger,
      getReady: ctx.getReady,
    })

    const nodeServer = bindServer(app, ctx.config, ctx.logger)

    const running = createRunningServer({
      nodeServer,
      clock: ctx.clock,
      logger: ctx.logger,
      config: ctx.config,
      stopHooks: ctx.options.beforeStop ?? [],
      setReady: ctx.setReady,
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
