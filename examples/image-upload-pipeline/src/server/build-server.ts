import {
  type Application,
  createServer,
  type LifecycleHook,
  type Server,
} from "@subspace/server"
import type { AppContext } from "../app/create-context"
import { createStartHooks, createStopHooks } from "../app/lifecycle"

export type BuiltServer = {
  app: Application
  server: Server
  startHooks: LifecycleHook[]
  stopHooks: LifecycleHook[]
}

export function buildServer(ctx: AppContext): BuiltServer {
  const startHooks = createStartHooks(ctx)
  const stopHooks = createStopHooks(ctx)

  const server = createServer(
    {
      clock: ctx.services.clock,
      logger: ctx.services.logger,
    },
    {
      host: ctx.config.server.host,
      port: ctx.config.server.port,

      errorHandling: {
        kind: "mappings",
        config: {
          mappings: {
            file_too_large: {
              status: 413,
              message: "Upload exceeds maximum allowed size",
            },
            upload_not_found: { status: 404, message: "Upload not found" },
            upload_failed: { status: 409, message: "Upload failed" },
          },
        },
      },

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
