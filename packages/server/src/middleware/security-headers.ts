import type { Middleware } from "../create-server"
import { setHeaderIfMissing } from "./utils/set-header-if-missing"

export type FrameOptions = "DENY" | "SAMEORIGIN"

export type ReferrerPolicy =
  | "no-referrer"
  | "no-referrer-when-downgrade"
  | "origin"
  | "origin-when-cross-origin"
  | "same-origin"
  | "strict-origin"
  | "strict-origin-when-cross-origin"
  | "unsafe-url"

export type PermittedCrossDomainPolicies =
  | "none"
  | "master-only"
  | "by-content-type"
  | "all"

export type CrossOriginOpenerPolicy =
  | "same-origin"
  | "same-origin-allow-popups"
  | "unsafe-none"

export type CrossOriginEmbedderPolicy = "require-corp" | "unsafe-none"

export type CrossOriginResourcePolicy = "same-origin" | "same-site" | "cross-origin"

/**
 * Minimal security headers.
 *
 * Notes:
 * - Prefer CSP for XSS protection; X-XSS-Protection is legacy. If set, we set it to "0".
 * - We avoid clobbering headers if the app already set them.
 *
 * @see {@link https://owasp.org/www-project-secure-headers | OWASP Secure Headers Project}
 */
export interface SecurityHeadersConfig {
  /**
   * Prevent MIME type sniffing.
   * @default "nosniff"
   */
  contentTypeOptions?: boolean | "nosniff"

  /**
   * Prevent clickjacking.
   * @default "DENY"
   */
  frameOptions?: boolean | FrameOptions

  /**
   * Legacy header. When enabled, we set `X-XSS-Protection: 0` to explicitly disable buggy
   * browser XSS filters.
   *
   * @default true
   */
  xssProtection?: boolean

  /**
   * Control referrer information.
   * @default "no-referrer"
   */
  referrerPolicy?: boolean | ReferrerPolicy

  /**
   * Prevents Adobe Flash / Acrobat cross-domain policies.
   * @default "none"
   */
  permittedCrossDomainPolicies?: boolean | PermittedCrossDomainPolicies

  /**
   * Cross-Origin-Opener-Policy (COOP)
   * @default "same-origin"
   */
  crossOriginOpenerPolicy?: boolean | CrossOriginOpenerPolicy

  /**
   * Cross-Origin-Embedder-Policy (COEP)
   * @default "require-corp" - can break third-party resources
   */
  crossOriginEmbedderPolicy?: boolean | CrossOriginEmbedderPolicy

  /**
   * Cross-Origin-Resource-Policy (CORP)
   * @default "same-origin"
   */
  crossOriginResourcePolicy?: boolean | CrossOriginResourcePolicy

  /**
   * Cache-Control
   * @default "no-store, max-age=0"
   */
  cacheControl?: boolean | string

  /**
   * Controls DNS prefetching.
   * @default "off"
   */
  dnsPrefetchControl?: boolean | "off" | "on"

  /**
   * Explicitly set CSP (defaults to OWASP’s baseline policy).
   */
  contentSecurityPolicy?: boolean | string[]

  /**
   * Explicitly set Permissions-Policy (defaults to OWASP’s baseline policy).
   */
  permissionsPolicy?: boolean | string[]
}

type SecureHeadersDefaults = {
  contentTypeOptions: "nosniff"
  frameOptions: FrameOptions
  xssProtection: boolean
  referrerPolicy: ReferrerPolicy
  permittedCrossDomainPolicies: PermittedCrossDomainPolicies
  crossOriginOpenerPolicy: CrossOriginOpenerPolicy
  crossOriginEmbedderPolicy: CrossOriginEmbedderPolicy
  crossOriginResourcePolicy: CrossOriginResourcePolicy
  cacheControl: string
  dnsPrefetchControl: "off" | "on"
  contentSecurityPolicy: string[]
  permissionsPolicy: string[]
}

const DEFAULTS: SecureHeadersDefaults = {
  contentTypeOptions: "nosniff",
  frameOptions: "DENY",
  xssProtection: true,
  referrerPolicy: "strict-origin-when-cross-origin",
  permittedCrossDomainPolicies: "none",
  crossOriginOpenerPolicy: "same-origin",
  crossOriginEmbedderPolicy: "require-corp",
  crossOriginResourcePolicy: "same-origin",
  cacheControl: "no-store, max-age=0",
  dnsPrefetchControl: "off",
  contentSecurityPolicy: [
    "default-src 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ],
  permissionsPolicy: [
    "accelerometer=()",
    "autoplay=()",
    "camera=()",
    "cross-origin-isolated=()",
    "display-capture=()",
    "encrypted-media=()",
    "fullscreen=()",
    "geolocation=()",
    "gyroscope=()",
    "keyboard-map=()",
    "magnetometer=()",
    "microphone=()",
    "midi=()",
    "payment=()",
    "picture-in-picture=()",
    "publickey-credentials-get=()",
    "screen-wake-lock=()",
    "sync-xhr=(self)",
    "usb=()",
    "web-share=()",
    "xr-spatial-tracking=()",
    "clipboard-read=()",
    "clipboard-write=()",
    "gamepad=()",
    "hid=()",
    "idle-detection=()",
    "interest-cohort=()",
    "serial=()",
    "unload=()",
  ],
}
function resolveBooleanOrStringArray(
  value: boolean | string[] | undefined,
  defaultValue: string[],
): string | null {
  if (value === false) return null
  if (value === true || value === undefined) return defaultValue.join("; ")
  if (Array.isArray(value) && value.length > 0) return value.join("; ")
  return null
}

function resolveFrameOptions(
  value: SecurityHeadersConfig["frameOptions"],
): string | null {
  if (value === false) return null
  if (value === true) return "DENY"
  return value ?? "DENY"
}

function resolveReferrerPolicy(
  value: SecurityHeadersConfig["referrerPolicy"],
): string | null {
  if (value === false) return null
  if (value === true) return "no-referrer"
  return value ?? "no-referrer"
}

function resolveBooleanOrString<T extends string>(
  value: boolean | T | undefined | null,
  defaultValue: T,
): T | null {
  if (value === false) return null
  if (value === true) return defaultValue
  return value ?? defaultValue
}

function resolveBooleanOrStringLoose(
  value: boolean | string | undefined | null,
  defaultValue: string,
): string | null {
  if (value === false) return null
  if (value === true) return defaultValue
  const v = typeof value === "string" ? value.trim() : ""
  return v ? v : defaultValue
}

type HeaderPolicy = { key: string; value: string | null }

export function securityHeadersMiddleware(
  config: SecurityHeadersConfig = {},
): Middleware {
  const opts: SecurityHeadersConfig = { ...DEFAULTS, ...config }

  const headerPolicies: HeaderPolicy[] = [
    {
      key: "X-Content-Type-Options",
      value: resolveBooleanOrString(opts.contentTypeOptions, "nosniff"),
    },
    {
      key: "X-Frame-Options",
      value: resolveFrameOptions(opts.frameOptions),
    },
    {
      key: "X-XSS-Protection",
      value: opts.xssProtection ? "0" : null,
    },
    {
      key: "Referrer-Policy",
      value: resolveReferrerPolicy(opts.referrerPolicy),
    },
    {
      key: "X-Permitted-Cross-Domain-Policies",
      value: resolveBooleanOrString(opts.permittedCrossDomainPolicies, "none"),
    },
    {
      key: "Cross-Origin-Opener-Policy",
      value: resolveBooleanOrString(opts.crossOriginOpenerPolicy, "same-origin"),
    },
    {
      key: "Cross-Origin-Embedder-Policy",
      value: resolveBooleanOrString(opts.crossOriginEmbedderPolicy, "require-corp"),
    },
    {
      key: "Cross-Origin-Resource-Policy",
      value: resolveBooleanOrString(opts.crossOriginResourcePolicy, "same-origin"),
    },
    {
      key: "Cache-Control",
      value: resolveBooleanOrStringLoose(opts.cacheControl, "no-store, max-age=0"),
    },
    {
      key: "X-DNS-Prefetch-Control",
      value: resolveBooleanOrString(opts.dnsPrefetchControl, "off"),
    },
    {
      key: "Content-Security-Policy",
      value: resolveBooleanOrStringArray(
        opts.contentSecurityPolicy,
        DEFAULTS.contentSecurityPolicy,
      ),
    },
    {
      key: "Permissions-Policy",
      value: resolveBooleanOrStringArray(
        opts.permissionsPolicy,
        DEFAULTS.permissionsPolicy,
      ),
    },
  ]

  return async (c, next) => {
    await next()

    for (const { key, value } of headerPolicies) {
      setHeaderIfMissing(c.res.headers, key, value)
    }
  }
}
