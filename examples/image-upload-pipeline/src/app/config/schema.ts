import type { Milliseconds, Seconds } from "@subspace/clock"
import { type LogLevelName, logLevelNames } from "@subspace/logger"
import type { Bytes } from "@subspace/storage"
import { z } from "zod/mini"

export const envSchema = z.object({
  APP_ENV: z._default(z.string(), "development"),
  SERVICE_NAME: z._default(z.string(), "Image Upload Pipeline"),
  SERVER_HOST: z._default(z.string(), "0.0.0.0"),

  SERVER_PORT: z._default(z.coerce.number(), 4663),
  SERVER_SHUTDOWN_TIMEOUT_MS: z._default(z.coerce.number(), 10_000),
  SERVER_LIVENESS_PATH: z._default(z.string(), "/health/live"),
  SERVER_READINESS_PATH: z._default(z.string(), "/health/ready"),

  LOG_LEVEL: z._default(z.enum(logLevelNames), "info"),
  LOG_PRETTY: z._default(z.coerce.boolean(), false),

  REQUEST_ID_ENABLED: z._default(z.coerce.boolean(), true),
  REQUEST_ID_HEADER: z._default(z.string(), "x-request-id"),
  REQUEST_ID_FALLBACK_TO_TRACEPARENT: z._default(z.coerce.boolean(), false),

  REQUEST_LOGGING_ENABLED: z._default(z.coerce.boolean(), true),
  REQUEST_LOGGING_LEVEL: z._default(z.enum(logLevelNames), "info"),

  CLIENT_IP_ENABLED: z._default(z.coerce.boolean(), true),
  CLIENT_IP_TRUSTED_PROXIES: z._default(z.coerce.number(), 0),

  UPLOAD_PRESIGN_TTL: z._default(z.coerce.number(), 300),
  UPLOAD_MAX_SIZE_BYTES: z._default(z.coerce.number(), 10_000_000),
  UPLOAD_WORKER_ENABLED: z._default(z.coerce.boolean(), true),
  UPLOAD_WORKER_POLL_MS: z._default(z.coerce.number(), 1000),
  UPLOAD_WORKER_LEASE_MS: z._default(z.coerce.number(), 30_000),

  UPLOAD_WORKER_CONCURRENCY: z._default(z.coerce.number(), 4),
  UPLOAD_WORKER_CAPACITY_POLL_MS: z._default(z.coerce.number(), 100),
  UPLOAD_WORKER_DRAIN_POLL_MS: z._default(z.coerce.number(), 100),

  UPLOAD_WORKER_IDLE_BASE_MS: z._default(z.coerce.number(), 100),
  UPLOAD_WORKER_IDLE_FACTOR: z._default(z.coerce.number(), 2),
  UPLOAD_WORKER_IDLE_MIN_MS: z._default(z.coerce.number(), 100),
  UPLOAD_WORKER_IDLE_MAX_MS: z._default(z.coerce.number(), 30_000),
  UPLOAD_WORKER_IDLE_JITTER_MIN_MS: z._default(z.coerce.number(), 50),

  UPLOAD_IO_RETRY_BASE_MS: z._default(z.coerce.number(), 100),
  UPLOAD_IO_RETRY_FACTOR: z._default(z.coerce.number(), 2),
  UPLOAD_IO_RETRY_MAX_ATTEMPTS: z._default(z.coerce.number(), 3),
  UPLOAD_IO_RETRY_MIN_MS: z._default(z.coerce.number(), 50),
  UPLOAD_IO_RETRY_MAX_MS: z._default(z.coerce.number(), 2_000),
  UPLOAD_IO_RETRY_JITTER_MIN_MS: z._default(z.coerce.number(), 25),
  UPLOAD_IO_RETRY_MAX_ELAPSED_MS: z.optional(z.coerce.number()),

  UPLOAD_JOB_MAX_ATTEMPTS: z._default(z.coerce.number(), 5),
  UPLOAD_JOB_RETRY_BASE_MS: z._default(z.coerce.number(), 1000),
  UPLOAD_JOB_RETRY_FACTOR: z._default(z.coerce.number(), 2),
  UPLOAD_JOB_RETRY_MAX_MS: z._default(z.coerce.number(), 300_000),

  UPLOAD_STAGING_PREFIX: z._default(z.string(), "staging"),
  UPLOAD_FINAL_PREFIX: z._default(z.string(), "final"),

  UPLOAD_THUMBNAIL_WIDTH: z._default(z.coerce.number(), 256),
  UPLOAD_THUMBNAIL_HEIGHT: z._default(z.coerce.number(), 256),
  UPLOAD_PREVIEW_WIDTH: z._default(z.coerce.number(), 1600),
  UPLOAD_PREVIEW_HEIGHT: z._default(z.coerce.number(), 1600),

  REDIS_URL: z._default(z.string(), "redis://localhost:16383"),
  REDIS_KEY_PREFIX: z._default(z.string(), "app:image-upload"),

  S3_BUCKET: z._default(z.string(), "image-upload-pipeline"),
  S3_REGION: z._default(z.string(), "us-east-1"),
  S3_ENDPOINT: z.optional(z.string()),
  S3_KEY_PREFIX: z._default(z.string(), "uploads"),
})

export type EnvConfig = z.infer<typeof envSchema>

export type AppConfig = {
  app: {
    env: string
  }

  server: {
    host: string
    port: number
    shutdownTimeoutMs: Milliseconds
    livenessPath: string
    readinessPath: string
  }

  logging: {
    level: LogLevelName
    prettify: boolean
    serviceName: string
  }

  requestId: {
    enabled: boolean
    header: string
    fallbackToTraceparent: boolean
  }

  requestLogging: {
    enabled: boolean
    level: LogLevelName
  }

  clientIp: {
    enabled: boolean
    trustedProxies: number
  }

  uploads: {
    api: {
      presignExpirySeconds: Seconds
      maxUploadSizeBytes: Bytes
    }
    worker: {
      enabled: boolean
      pollIntervalMs: Milliseconds
      leaseDurationMs: Milliseconds
      concurrency: number
      capacityPollMs: Milliseconds
      drainPollMs: Milliseconds
      idleBackoff: {
        baseMs: Milliseconds
        factor: number
        minMs: Milliseconds
        maxMs: Milliseconds
        jitterMinMs: Milliseconds
      }
      ioRetry: {
        maxAttempts: number
        baseMs: Milliseconds
        factor: number
        minMs: Milliseconds
        maxMs: Milliseconds
        jitterMinMs: Milliseconds
        maxElapsedMs?: Milliseconds
      }
      jobRetry: {
        maxAttempts: number
        baseMs: Milliseconds
        factor: number
        maxMs: Milliseconds
      }
    }
    storage: {
      stagingPrefix: string
      finalPrefix: string
    }
    images: {
      thumbnail: { width: number; height: number }
      preview: { width: number; height: number }
    }
  }

  redis: {
    url: string
    keyPrefix: string
  }
  s3: {
    bucket: string
    region: string
    endpoint?: string
    keyPrefix: string
  }
}
