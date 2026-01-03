import type { Seconds } from "@subspace/clock"
import type { Middleware } from "../create-server"

export interface HstsConfig {
  /** @default 31536000 seconds (1 year) */
  maxAge?: Seconds

  /** @default true */
  includeSubDomains?: boolean

  /** @default false - WARNING: permanent, cannot be easily undone */
  preload?: boolean
}

const DEFAULTS: Required<HstsConfig> = {
  maxAge: 31536000,
  includeSubDomains: true,
  preload: false,
}

/**
 * Adds HTTP Strict Transport Security header.
 *
 * @remarks
 * - Only use on HTTPS sites
 * - `preload` submits to browser preload lists - cannot be easily undone
 * - Start with short `maxAge` (e.g., 300) to test, then increase
 */
export function hstsMiddleware(config: HstsConfig = {}): Middleware {
  const opts = { ...DEFAULTS, ...config }
  const HSTS_HEADER_NAME = "Strict-Transport-Security"

  const parts = [`max-age=${opts.maxAge}`]

  if (opts.includeSubDomains) parts.push("includeSubDomains")
  if (opts.preload) parts.push("preload")

  const headerValue = parts.join("; ")

  return async (c, next) => {
    await next()

    const rawProto = c.req.header("x-forwarded-proto") ?? new URL(c.req.url).protocol

    const proto = rawProto.split(",")[0]?.trim().toLowerCase()
    const isHttps = proto === "https" || proto === "https:"

    if (isHttps && !c.res.headers.has(HSTS_HEADER_NAME)) {
      c.res.headers.set(HSTS_HEADER_NAME, headerValue)
    }
  }
}
