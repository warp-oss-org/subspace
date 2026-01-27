import { type ConfigSource, DotenvSource, EnvSource, loadConfig } from "@subspace/config"
import { applyOverrides, type DeepPartial } from "@subspace/server"
import type { AppConfig } from "."
import { type EnvConfig, envSchema } from "./schema"

export function mapEnvToConfig(env: EnvConfig): AppConfig {
  return {
    app: {
      env: env.APP_ENV,
    },
    server: {
      host: env.SERVER_HOST,
      port: env.SERVER_PORT,
      shutdownTimeoutMs: env.SERVER_SHUTDOWN_TIMEOUT_MS,
      livenessPath: env.SERVER_LIVENESS_PATH,
      readinessPath: env.SERVER_READINESS_PATH,
    },
    logging: {
      level: env.LOG_LEVEL,
      prettify: env.LOG_PRETTY,
      serviceName: env.SERVICE_NAME,
    },
    requestId: {
      enabled: env.REQUEST_ID_ENABLED,
      header: env.REQUEST_ID_HEADER,
      fallbackToTraceparent: env.REQUEST_ID_FALLBACK_TO_TRACEPARENT,
    },
    requestLogging: {
      enabled: env.REQUEST_LOGGING_ENABLED,
      level: env.REQUEST_LOGGING_LEVEL,
    },
    clientIp: {
      enabled: env.CLIENT_IP_ENABLED,
      trustedProxies: env.CLIENT_IP_TRUSTED_PROXIES,
    },
    uploads: {
      api: { presignExpirySeconds: env.UPLOAD_PRESIGN_TTL },
      worker: {
        enabled: env.UPLOAD_WORKER_ENABLED,
        pollIntervalMs: env.UPLOAD_WORKER_POLL_MS,
        leaseDurationMs: env.UPLOAD_WORKER_LEASE_MS,
        concurrency: env.UPLOAD_WORKER_CONCURRENCY,
        capacityPollMs: env.UPLOAD_WORKER_CAPACITY_POLL_MS,
        drainPollMs: env.UPLOAD_WORKER_DRAIN_POLL_MS,
        idleBackoff: {
          baseMs: env.UPLOAD_WORKER_IDLE_BASE_MS,
          factor: env.UPLOAD_WORKER_IDLE_FACTOR,
          minMs: env.UPLOAD_WORKER_IDLE_MIN_MS,
          maxMs: env.UPLOAD_WORKER_IDLE_MAX_MS,
          jitterMinMs: env.UPLOAD_WORKER_IDLE_JITTER_MIN_MS,
        },
        ioRetry: {
          maxAttempts: env.UPLOAD_IO_RETRY_MAX_ATTEMPTS,
          baseMs: env.UPLOAD_IO_RETRY_BASE_MS,
          factor: env.UPLOAD_IO_RETRY_FACTOR,
          minMs: env.UPLOAD_IO_RETRY_MIN_MS,
          maxMs: env.UPLOAD_IO_RETRY_MAX_MS,
          jitterMinMs: env.UPLOAD_IO_RETRY_JITTER_MIN_MS,
          ...(env.UPLOAD_IO_RETRY_MAX_ELAPSED_MS !== undefined && {
            maxElapsedMs: env.UPLOAD_IO_RETRY_MAX_ELAPSED_MS,
          }),
        },
        jobRetry: {
          maxAttempts: env.UPLOAD_JOB_MAX_ATTEMPTS,
          baseMs: env.UPLOAD_JOB_RETRY_BASE_MS,
          factor: env.UPLOAD_JOB_RETRY_FACTOR,
          maxMs: env.UPLOAD_JOB_RETRY_MAX_MS,
        },
      },
      storage: {
        stagingPrefix: env.UPLOAD_STAGING_PREFIX,
        finalPrefix: env.UPLOAD_FINAL_PREFIX,
      },
      images: {
        thumbnail: {
          width: env.UPLOAD_THUMBNAIL_WIDTH,
          height: env.UPLOAD_THUMBNAIL_HEIGHT,
        },
        preview: {
          width: env.UPLOAD_PREVIEW_WIDTH,
          height: env.UPLOAD_PREVIEW_HEIGHT,
        },
      },
    },
    redis: {
      url: env.REDIS_URL,
      keyPrefix: env.REDIS_KEY_PREFIX,
    },
    s3: {
      bucket: env.S3_BUCKET,
      region: env.S3_REGION,
      keyPrefix: env.S3_KEY_PREFIX,
      ...(env.S3_ENDPOINT !== undefined && { endpoint: env.S3_ENDPOINT }),
    },
  }
}

export async function loadAppConfig(
  env: NodeJS.ProcessEnv,
  overrides?: DeepPartial<AppConfig>,
  cwd: string = process.cwd(),
): Promise<AppConfig> {
  const nodeEnv = env.NODE_ENV

  const sources: ConfigSource[] = [
    new DotenvSource({ file: `.env.${nodeEnv}`, required: false, cwd }),
    new EnvSource({ env }),
  ]

  const result = await loadConfig({
    schema: envSchema,
    sources,
    expandEnv: true,
  })

  const config = mapEnvToConfig(result.value)

  return overrides ? applyOverrides(config, overrides) : config
}
