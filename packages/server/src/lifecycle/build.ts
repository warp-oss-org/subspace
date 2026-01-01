import type { Logger } from "@subspace/logger"
import { Hono } from "hono"

import type { ResolvedServerConfig, ServerOptions } from "../config"
import { applyErrorHandler } from "../errors/error-handler"
import { clientIpMiddleware } from "../middleware/client-ip"
import { headerSuppressionMiddleware } from "../middleware/header-suppression"
import { hstsMiddleware } from "../middleware/hsts"
import { requestIdMiddleware } from "../middleware/request-id"
import { requestLoggerMiddleware } from "../middleware/request-logger"
import { requestLoggingMiddleware } from "../middleware/request-logging"
import { securityHeadersMiddleware } from "../middleware/security-headers"
import { registerHealthRoutes } from "../routes/health"
import type { Application, Middleware } from "../server"

interface BuildAppContext {
  config: ResolvedServerConfig
  options: ServerOptions
  logger: Logger
  getReady: () => boolean
}

export function buildApp(ctx: BuildAppContext): Application {
  const { config, options, logger, getReady } = ctx
  const app = new Hono()

  if (config.health.enabled) {
    registerHealthRoutes(app, config.health, getReady)
  }

  applyDefaultMiddleware(app, config, logger)
  applyMiddleware(app, options.middleware?.pre)

  options.routes(app)

  applyMiddleware(app, options.middleware?.post)
  applyErrorHandler(app, config, logger)

  return app
}

function applyDefaultMiddleware(
  app: Application,
  config: ResolvedServerConfig,
  logger: Logger,
): void {
  app.use("*", headerSuppressionMiddleware())
  app.use("*", securityHeadersMiddleware())
  app.use("*", hstsMiddleware())

  if (config.requestId.enabled) {
    app.use("*", requestIdMiddleware(config.requestId))
  }

  if (config.clientIp.enabled) {
    app.use("*", clientIpMiddleware(config.clientIp.trustedProxies))
  }

  app.use("*", requestLoggerMiddleware(logger))

  if (config.requestLogging.enabled) {
    app.use("*", requestLoggingMiddleware(config.requestLogging, logger))
  }
}

function applyMiddleware(app: Application, middleware: Middleware[] | undefined): void {
  if (!middleware?.length) return

  for (const mw of middleware) app.use("*", mw)
}
