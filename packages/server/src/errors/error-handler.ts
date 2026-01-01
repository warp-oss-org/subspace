import type { ErrorCode } from "@subspace/errors"
import type { Logger } from "@subspace/logger"
import type { ErrorHandler as HonoErrorHandler } from "hono"
import { routePath } from "hono/route"
import type { ResolvedServerConfig } from "../config"
import type { StatusCode } from "../http/status-codes"
import type { Application } from "../server"
import { createErrorFormatter, type ErrorMappingsConfig } from "./errors"

export type ErrorHandler = HonoErrorHandler

export function applyErrorHandler(
  app: Application,
  config: ResolvedServerConfig,
  logger: Logger,
): void {
  const handler =
    config.errorHandling.kind === "handler"
      ? config.errorHandling.errorHandler
      : buildErrorHandler(config.errorHandling.config, logger)

  app.onError(handler)
}

function buildErrorHandler(mappings: ErrorMappingsConfig, logger: Logger): ErrorHandler {
  const formatter = createErrorFormatter(mappings)

  return (err, c) => {
    const requestId = c.get("requestId") ?? "unknown"
    const response = formatter(err, requestId)

    logError(logger, err, {
      requestId,
      method: c.req.method,
      route: routePath(c) ?? c.req.path,
      status: response.error.status,
      code: response.error.code,
    })

    return c.json(response, { status: response.error.status })
  }
}

type ErrorLogMeta = {
  requestId: string
  method: string
  route: string
  status: StatusCode
  code: ErrorCode
}

/**
 * Centralized error logging policy:
 * - 5xx => error with `err`
 * - 4xx => warn without `err`, debug with `err`
 */
function logError(logger: Logger, err: unknown, meta: ErrorLogMeta): void {
  const base = { ...meta, op: `${meta.method} ${meta.route}` }

  if (meta.status >= 500) {
    logger.error("Request failed", { ...base, err })
    return
  }

  logger.warn("Request failed", base)
  logger.debug("Request failed details", { ...base, err })
}
