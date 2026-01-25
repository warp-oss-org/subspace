import { randomUUID } from "node:crypto"
import type { Clock, Milliseconds } from "@subspace/clock"
import type { Logger, LogLevelName } from "@subspace/logger"
import { type Application, createApp, type Middleware } from "./create-server"
import type { ErrorHandler } from "./errors/create-error-handler"
import type { ErrorMappingsConfig } from "./errors/errors"
import type { LifecycleHook } from "./lifecycle/lifecycle-hook"

export type PathString = `/${string}`

export interface DisabledConfig {
  enabled: false
}

export interface ServerDependencies {
  logger: Logger
  clock: Clock
}

export interface EnabledRequestIdConfig {
  enabled: true

  /**
   * Header name to read/write request ID.
   * @default "x-request-id"
   */
  header?: string

  /**
   * If true, extract trace-id from `traceparent` header when request ID header is not present.
   * @default false
   */
  fallbackToTraceparent?: boolean

  /**
   * Function to generate a new request ID when none is present.
   * @default crypto.randomUUID()
   */
  generate?: () => string
}

export interface EnabledRequestLoggingConfig {
  enabled: true

  /**
   * Log level for request logging.
   * 5xx responses always log at `error` regardless of this setting.
   * @default "info"
   */
  level?: LogLevelName

  /**
   * Paths to ignore for request logging.
   * @default [livenessPath, readinessPath] if health checks are enabled, otherwise []
   */
  ignorePaths?: PathString[]
}

export interface ReadinessCheck {
  name: string
  timeoutMs?: Milliseconds
  fn: (signal: AbortSignal) => Promise<boolean>
}

export interface EnabledHealthConfig {
  enabled: true

  /**
   * Path for liveness endpoint.
   * @default "/health"
   */
  livenessPath?: PathString

  /**
   * Path for readiness endpoint.
   * @default "/ready"
   */
  readinessPath?: PathString

  /**
   * Readiness checks to run on each request to the readiness endpoint.
   * @default []
   */
  readinessChecks?: ReadinessCheck[]

  /**
   * Default timeout for readiness checks. Individual checks can override via `timeoutMs`.
   * @default 5_000
   */
  checkTimeoutMs?: Milliseconds
}

export interface ClientIpConfig {
  enabled?: boolean

  /**
   * If set, trust X-Forwarded-For and compute the client IP assuming this many
   * proxies at the end of the chain are trusted.
   *
   * Example XFF: "client, proxy1, proxy2"
   * trustedProxies=1 => client is "proxy1"
   *
   * @default undefined
   */
  trustedProxies?: number
}

export type ErrorHandling =
  | { kind: "handler"; errorHandler: ErrorHandler }
  | { kind: "mappings"; config: ErrorMappingsConfig }

export type RequestIdConfig = DisabledConfig | EnabledRequestIdConfig
export type RequestLoggingConfig = DisabledConfig | EnabledRequestLoggingConfig
export type HealthConfig = DisabledConfig | EnabledHealthConfig

export interface ServerOptions {
  port: number

  /**
   * Host to bind to.
   * @default "0.0.0.0"
   */
  host?: string

  /**
   * Timeout for server startup in milliseconds.
   * @default 2_147_483_647 (max timer value, effectively no timeout)
   */
  startupTimeoutMs?: Milliseconds

  /**
   * Timeout for graceful shutdown in milliseconds.
   * @default 10_000
   */
  shutdownTimeoutMs?: Milliseconds

  requestId?: RequestIdConfig
  requestLogging?: RequestLoggingConfig
  health?: HealthConfig

  /**
   * Client IP extraction.
   *
   * - If disabled, no IP is attached to the request context
   * - If enabled without `trustedProxies`, uses the direct remote address
   * - If `trustedProxies` is set, uses X-Forwarded-For accordingly
   *
   * @default { enabled: true }
   */
  clientIp?: ClientIpConfig

  errorHandling: ErrorHandling

  createApp?: () => Application

  routes: (app: Application) => void

  middleware?: {
    pre?: Middleware[]
    post?: Middleware[]
  }

  startHooks?: LifecycleHook[]
  stopHooks?: LifecycleHook[]
}

// --- Resolved types ---

export type ResolvedRequestIdConfig = DisabledConfig | Required<EnabledRequestIdConfig>

export type ResolvedRequestLoggingConfig =
  | DisabledConfig
  | Required<EnabledRequestLoggingConfig>

export type ResolvedHealthConfig = DisabledConfig | Required<EnabledHealthConfig>

export interface ResolvedClientIpConfig {
  enabled: boolean
  trustedProxies?: number
}

export interface ResolvedMiddleware {
  pre: Middleware[]
  post: Middleware[]
}

export type ResolvedServerOptions = {
  port: number
  host: string
  startupTimeoutMs: Milliseconds
  shutdownTimeoutMs: Milliseconds
  requestId: ResolvedRequestIdConfig
  requestLogging: ResolvedRequestLoggingConfig
  health: ResolvedHealthConfig
  clientIp: ResolvedClientIpConfig
  errorHandling: ErrorHandling

  createApp: () => Application
  routes: (app: Application) => void
  middleware: ResolvedMiddleware
  startHooks: LifecycleHook[]
  stopHooks: LifecycleHook[]
}

// --- Defaults ---

const MAX_TIMER_MS = 2_147_483_647 as Milliseconds

interface ServerDefaults {
  host: string
  startupTimeoutMs: Milliseconds
  shutdownTimeoutMs: Milliseconds
  requestId: Required<EnabledRequestIdConfig>
  requestLogging: { enabled: true; level: LogLevelName }
  health: Required<EnabledHealthConfig>
  clientIp: { enabled: boolean }
}

export const DEFAULTS: ServerDefaults = {
  host: "0.0.0.0",
  startupTimeoutMs: MAX_TIMER_MS,
  shutdownTimeoutMs: 10_000 as Milliseconds,
  requestId: {
    enabled: true,
    header: "x-request-id",
    fallbackToTraceparent: false,
    generate: () => randomUUID(),
  },
  requestLogging: {
    enabled: true,
    level: "info",
  },
  health: {
    enabled: true,
    livenessPath: "/health",
    readinessPath: "/ready",
    readinessChecks: [],
    checkTimeoutMs: 5_000 as Milliseconds,
  },
  clientIp: {
    enabled: true,
  },
}

// --- Resolution ---

export function resolveOptions(options: ServerOptions): ResolvedServerOptions {
  const health = resolveHealthConfig(options)
  const requestId = resolveRequestIdConfig(options)
  const clientIp = resolveClientIpConfig(options)
  const requestLogging = resolveRequestLoggingConfig(options, health)

  return {
    port: options.port,
    host: options.host ?? DEFAULTS.host,
    startupTimeoutMs: options.startupTimeoutMs ?? DEFAULTS.startupTimeoutMs,
    shutdownTimeoutMs: options.shutdownTimeoutMs ?? DEFAULTS.shutdownTimeoutMs,
    requestId,
    requestLogging,
    health,
    clientIp,
    errorHandling: options.errorHandling,
    routes: options.routes,
    createApp: options.createApp ?? createApp,
    middleware: {
      pre: options.middleware?.pre ?? [],
      post: options.middleware?.post ?? [],
    },
    startHooks: options.startHooks ?? [],
    stopHooks: options.stopHooks ?? [],
  }
}

function resolveHealthConfig(options: ServerOptions): ResolvedHealthConfig {
  if (options.health?.enabled === false) {
    return { enabled: false }
  }

  return {
    ...DEFAULTS.health,
    ...options.health,
    enabled: true,
  }
}

function resolveRequestIdConfig(options: ServerOptions): ResolvedRequestIdConfig {
  if (options.requestId?.enabled === false) {
    return { enabled: false }
  }

  return {
    ...DEFAULTS.requestId,
    ...options.requestId,
    enabled: true,
  }
}

function resolveRequestLoggingConfig(
  options: ServerOptions,
  health: ResolvedHealthConfig,
): ResolvedRequestLoggingConfig {
  if (options.requestLogging?.enabled === false) {
    return { enabled: false }
  }

  return {
    enabled: true,
    level: options.requestLogging?.level ?? DEFAULTS.requestLogging.level,
    ignorePaths:
      options.requestLogging?.ignorePaths ??
      (health.enabled ? [health.livenessPath, health.readinessPath] : []),
  }
}

function resolveClientIpConfig(options: ServerOptions): ResolvedClientIpConfig {
  const enabled = options.clientIp?.enabled ?? DEFAULTS.clientIp.enabled
  const trustedProxiesRaw = options.clientIp?.trustedProxies

  const trustedProxies =
    typeof trustedProxiesRaw === "number"
      ? Math.max(0, Math.floor(trustedProxiesRaw))
      : undefined

  return {
    enabled,
    ...(trustedProxies !== undefined && { trustedProxies }),
  }
}
