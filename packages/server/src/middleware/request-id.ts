import type { Context } from "hono"
import type { EnabledRequestIdConfig } from "../config"
import type { Middleware } from "../server"
import { isNonEmptyString } from "./utils/is-non-empty-string"
import { setHeaderIfMissing } from "./utils/set-header-if-missing"

function traceIdFromTraceparent(tp: string): string | null {
  const parts = tp.split("-")
  const traceId = parts.length >= 4 ? parts[1] : null

  if (!traceId) return null
  if (!/^[0-9a-f]{32}$/i.test(traceId)) return null
  if (/^0{32}$/.test(traceId)) return null

  return traceId
}

/**
 * Ensures a requestId exists on the request context.
 * Returns the resolved requestId.
 */
function resolveRequestId(c: Context, config: Required<EnabledRequestIdConfig>): string {
  const existing = c.get("requestId")

  if (isNonEmptyString(existing)) return existing

  const headerName = config.header.toLowerCase()
  const fromHeader = c.req.header(headerName) ?? c.req.header(config.header)

  if (isNonEmptyString(fromHeader)) return fromHeader

  if (config.fallbackToTraceparent) {
    const tp = c.req.header("traceparent")

    if (tp) {
      const traceId = traceIdFromTraceparent(tp)
      if (traceId) return traceId
    }
  }

  return config.generate()
}

/**
 * Generates or extracts request ID and:
 * - attaches it to the request context
 * - mirrors it onto the response header
 */
export function requestIdMiddleware(
  config: Required<EnabledRequestIdConfig>,
): Middleware {
  return async (c, next) => {
    const headerName = config.header.toLowerCase()
    const requestId = resolveRequestId(c, config)

    c.set("requestId", requestId)

    await next()

    setHeaderIfMissing(c.res.headers, headerName, requestId)
  }
}
