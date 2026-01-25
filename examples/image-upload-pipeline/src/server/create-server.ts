import {
  type Application,
  createServer,
  type LifecycleHook,
  type Server,
} from "@subspace/server"
import type { AppContext } from "../app/create-context"
import { createStartHooks } from "../app/lifecycle/start"
import { createStopHooks } from "../app/lifecycle/stop"

export type BuiltServer = {
  app: Application
  server: Server
  startHooks: LifecycleHook[]
  stopHooks: LifecycleHook[]
}

export function buildServer(ctx: AppContext): BuiltServer {
  const startHooks = createStartHooks(ctx.config, ctx.services)
  const stopHooks = createStopHooks(ctx.config, ctx.services)

  const server = createServer(
    {
      clock: ctx.services.clock,
      logger: ctx.services.logger,
    },
    {
      host: ctx.config.server.host,
      port: ctx.config.server.port,

      errorHandling: { kind: "mappings", config: { mappings: {} } },

      requestId: {
        enabled: ctx.config.requestId.enabled,
        header: ctx.config.requestId.header,
        fallbackToTraceparent: ctx.config.requestId.fallbackToTraceparent,
      },

      requestLogging: {
        enabled: ctx.config.requestLogging.enabled,
        level: ctx.config.requestLogging.level,
      },

      clientIp: {
        enabled: ctx.config.clientIp.enabled,
        trustedProxies: ctx.config.clientIp.trustedProxies,
      },

      routes: (app: Application): void => {
        ctx.registerRoutes(app, ctx.config, ctx.services)
      },

      startHooks,
      stopHooks,
    },
  )

  return {
    app: server.app,
    server,
    startHooks,
    stopHooks,
  }
}
