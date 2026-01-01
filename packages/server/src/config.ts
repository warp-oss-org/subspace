import { randomUUID } from "node:crypto"
import type { Clock, Milliseconds } from "@subspace/clock"
import type { Logger, LogLevelName } from "@subspace/logger"
import type { ErrorHandler } from "./errors/error-handler"
import type { ErrorMappingsConfig } from "./errors/errors"
import type { LifecycleHook } from "./lifecycle/lifecycle"
import type { Application, Middleware } from "./server"

export type PathString = `/${string}`

export interface DisabledConfig {
  enabled: false
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
   * @default ["/health", "/ready"] if health checks are enabled
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
   * If set, we trust X-Forwarded-For and compute the client IP assuming this many
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

export interface ServerConfig {
  port: number

  /**
   * Host to bind to.
   * @default "0.0.0.0"
   */
  host?: string

  /**
   * Timeout for server startup in milliseconds.
   *
   * @default undefined (no timeout)
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
   */
  clientIp?: ClientIpConfig

  errorHandling: ErrorHandling
}

export interface ServerDependencies {
  config: ServerConfig
  logger: Logger
  clock: Clock
}

export interface ServerOptions {
  routes: (app: Application) => void
  middleware?: {
    pre?: Middleware[]
    post?: Middleware[]
  }
  beforeStart?: LifecycleHook[]
  beforeStop?: LifecycleHook[]
}

export type ResolvedRequestIdConfig = DisabledConfig | Required<EnabledRequestIdConfig>

export type ResolvedRequestLoggingConfig =
  | DisabledConfig
  | Required<EnabledRequestLoggingConfig>

export type ResolvedHealthConfig = DisabledConfig | Required<EnabledHealthConfig>

export type ResolvedClientIpConfig = {
  enabled: boolean
  trustedProxies?: number
}

export type ResolvedServerConfig = Required<
  Omit<ServerConfig, "requestId" | "requestLogging" | "health" | "clientIp">
> & {
  requestId: ResolvedRequestIdConfig
  requestLogging: ResolvedRequestLoggingConfig
  health: ResolvedHealthConfig
  clientIp: ResolvedClientIpConfig
}

interface ServerDefaults {
  host: string
  shutdownTimeoutMs: Milliseconds
  startupTimeoutMs: Milliseconds
  requestId: Required<EnabledRequestIdConfig>
  requestLogging: { enabled: true; level: LogLevelName }
  health: Required<EnabledHealthConfig>
  clientIp: ResolvedClientIpConfig
}

const MAX_TIMER_MS = 2_147_483_647
export const DEFAULTS: ServerDefaults = {
  host: "0.0.0.0",
  shutdownTimeoutMs: 10_000,
  startupTimeoutMs: MAX_TIMER_MS,
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
    checkTimeoutMs: 5_000,
  },
  clientIp: {
    enabled: true,
  },
}

export function resolveConfig(config: ServerConfig): ResolvedServerConfig {
  const health: ResolvedHealthConfig = resolveHealthConfig(config)
  const requestId: ResolvedRequestIdConfig = resolveRequestIdConfig(config)
  const clientIp: ResolvedClientIpConfig = resolveClientIpConfig(config)
  const requestLogging: ResolvedRequestLoggingConfig = resolveRequestLoggingConfig(
    config,
    health,
  )

  return {
    port: config.port,
    host: config.host ?? DEFAULTS.host,
    startupTimeoutMs: config.startupTimeoutMs ?? DEFAULTS.startupTimeoutMs,
    shutdownTimeoutMs: config.shutdownTimeoutMs ?? DEFAULTS.shutdownTimeoutMs,
    requestId,
    requestLogging,
    health,
    clientIp,
    errorHandling: config.errorHandling,
  }
}

function resolveClientIpConfig(config: ServerConfig) {
  const trustedProxiesRaw = config.clientIp?.trustedProxies
  const trustedProxies =
    typeof trustedProxiesRaw === "number"
      ? Math.max(0, Math.floor(trustedProxiesRaw))
      : undefined

  const clientIp: ResolvedClientIpConfig = {
    enabled: config.clientIp?.enabled ?? DEFAULTS.clientIp.enabled,
    ...(trustedProxies !== undefined && { trustedProxies }),
  }

  return clientIp
}

function resolveRequestLoggingConfig(
  config: ServerConfig,
  health: ResolvedHealthConfig,
): ResolvedRequestLoggingConfig {
  return config.requestLogging?.enabled === false
    ? { enabled: false }
    : {
        enabled: true,
        level: config.requestLogging?.level ?? DEFAULTS.requestLogging.level,
        ignorePaths:
          config.requestLogging?.ignorePaths ??
          (health.enabled ? [health.livenessPath, health.readinessPath] : []),
      }
}

function resolveRequestIdConfig(config: ServerConfig): ResolvedRequestIdConfig {
  return config.requestId?.enabled === false
    ? { enabled: false }
    : {
        ...DEFAULTS.requestId,
        ...config.requestId,
        enabled: true,
      }
}

function resolveHealthConfig(config: ServerConfig): ResolvedHealthConfig {
  return config.health?.enabled === false
    ? { enabled: false }
    : {
        ...DEFAULTS.health,
        ...config.health,
        enabled: true,
      }
}
