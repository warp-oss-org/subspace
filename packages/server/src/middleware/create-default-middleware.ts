import type { Logger } from "@subspace/logger"
import type { Middleware } from "../server"
import type { ResolvedServerOptions } from "../server/server-options"
import { clientIpMiddleware } from "./client-ip"
import { headerSuppressionMiddleware } from "./header-suppression"
import { hstsMiddleware } from "./hsts"
import { requestIdMiddleware } from "./request-id"
import { requestLoggerMiddleware } from "./request-logger"
import { requestLoggingMiddleware } from "./request-logging"
import { securityHeadersMiddleware } from "./security-headers"

export function createDefaultMiddleware(
  options: ResolvedServerOptions,
  logger: Logger,
): Middleware[] {
  const middleware: Middleware[] = []

  middleware.push(headerSuppressionMiddleware())
  middleware.push(securityHeadersMiddleware())
  middleware.push(hstsMiddleware())

  if (options.requestId.enabled) {
    middleware.push(requestIdMiddleware(options.requestId))
  }

  if (options.clientIp.enabled) {
    middleware.push(clientIpMiddleware(options.clientIp.trustedProxies))
  }

  middleware.push(requestLoggerMiddleware(logger))

  if (options.requestLogging.enabled) {
    middleware.push(requestLoggingMiddleware(options.requestLogging, logger))
  }

  return middleware
}

export type CreateDefaultMiddlewareFn = typeof createDefaultMiddleware
