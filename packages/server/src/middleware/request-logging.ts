import type { Logger } from "@subspace/logger"
import { routePath } from "hono/route"
import type { Middleware } from "../server"
import type { EnabledRequestLoggingConfig, PathString } from "../server/server-options"
import { isNonEmptyString } from "./utils/is-non-empty-string"

/**
 * Logs incoming requests and outgoing responses.
 *
 * Policy:
 * - 5xx => error
 * - else => config.level
 */
export function requestLoggingMiddleware(
  config: Required<EnabledRequestLoggingConfig>,
  baseLogger: Logger,
): Middleware {
  return async (c, next) => {
    const path = c.req.path

    if (shouldIgnore(path, config.ignorePaths)) {
      await next()
      return
    }

    const start = performance.now()

    try {
      await next()
    } finally {
      const status = c.res.status
      const durationMs = Math.round(performance.now() - start)

      const requestId = c.get("requestId") ?? "unknown"
      const clientIp = c.get("clientIp")
      const remoteIp = c.get("remoteIp")
      const userAgent = c.req.header("user-agent")

      const method = c.req.method
      const route = isNonEmptyString(routePath(c)) ? routePath(c) : c.req.path

      const meta = {
        requestId,
        method,
        path,
        route,
        op: `${method} ${route}`,
        status,
        durationMs,
        error: status >= 500,

        ...(clientIp !== undefined && { clientIp }),
        ...(remoteIp !== undefined && { remoteIp }),
        ...(userAgent !== undefined && { userAgent }),
      }

      const logger = c.get("logger") ?? baseLogger

      if (status >= 500) {
        logger.error("Request completed", meta)
      } else {
        logger[config.level]("Request completed", meta)
      }
    }
  }
}

function shouldIgnore(path: string, ignorePaths: PathString[]): boolean {
  return ignorePaths.some((ignored) => path === ignored || path.startsWith(`${ignored}/`))
}
