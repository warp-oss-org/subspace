import type { Middleware } from "../server"

/**
 * Removes headers that leak server implementation details.
 */
export function headerSuppressionMiddleware(): Middleware {
  const SUPPRESSED = ["X-Powered-By", "Server"] as const

  return async (c, next) => {
    await next()

    for (const h of SUPPRESSED) c.res.headers.delete(h)
  }
}
