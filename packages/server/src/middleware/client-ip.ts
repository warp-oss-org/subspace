import type { Context, Middleware } from "../create-server"
import { isNonEmptyString } from "./utils/is-non-empty-string"

/**
 * Returns the "client" IP from X-Forwarded-For given N trusted proxies.
 *
 * XFF: "client, proxy1, proxy2" (proxy2 is closest to your server)
 * trustedProxies = 1 -> "proxy1"
 * trustedProxies = 2 -> "client"
 */
export function ipFromXForwardedFor(
  xForwardedFor: string,
  trustedProxies: number,
): string | undefined {
  if (trustedProxies <= 0) return undefined

  const chain = xForwardedFor
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  if (chain.length === 0) return undefined

  const idx = chain.length - 1 - trustedProxies
  if (idx < 0) return undefined

  return chain[idx]
}

/**
 * Normalizes Node's remoteAddress:
 * - `::ffff:1.2.3.4` (IPv4-mapped IPv6) -> `1.2.3.4`
 */
function normalizeRemoteAddress(ip: string): string {
  return ip.startsWith("::ffff:") ? ip.slice("::ffff:".length) : ip
}

function resolveRemoteIp(c: Context): string | undefined {
  const raw = c.env?.incoming?.socket?.remoteAddress
  if (!isNonEmptyString(raw)) return undefined

  const normalized = normalizeRemoteAddress(raw).trim()
  return normalized.length > 0 ? normalized : undefined
}

function resolveClientIp(c: Context, trustedProxies: number): string | undefined {
  if (trustedProxies <= 0) return undefined

  const xff = c.req.header("x-forwarded-for")
  return isNonEmptyString(xff) ? ipFromXForwardedFor(xff, trustedProxies) : undefined
}

/**
 * Attaches IP info to request context.
 *
 * @remarks
 * - Always sets `remoteIp`, if available
 * - If `trustedProxies` is provided and > 0, also sets `clientIp` from X-Forwarded-For
 * - If `clientIp` is not available, falls back to `remoteIp`
 */
export function clientIpMiddleware(trustedProxies?: number): Middleware {
  const proxies = Math.max(0, trustedProxies ?? 0)

  return async (c, next) => {
    const existingClient = c.get("clientIp")
    const existingRemote = c.get("remoteIp")

    const hasClient = isNonEmptyString(existingClient)
    const hasRemote = isNonEmptyString(existingRemote)

    if (hasClient && hasRemote) {
      await next()
      return
    }

    const remoteIp = hasRemote ? undefined : resolveRemoteIp(c)
    const clientIp = hasClient ? undefined : resolveClientIp(c, proxies)

    const finalRemote = hasRemote ? existingRemote : remoteIp
    const finalClient = hasClient ? existingClient : (clientIp ?? finalRemote)

    if (!hasRemote && isNonEmptyString(finalRemote)) c.set("remoteIp", finalRemote)
    if (!hasClient && isNonEmptyString(finalClient)) c.set("clientIp", finalClient)

    await next()
  }
}
