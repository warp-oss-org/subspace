import { createBackoff, decorrelatedJitter, exponential } from "@subspace/backoff"
import type { AppConfig } from "../../../app/config"
import type { CoreServices } from "../../../app/services/core"
import type { JobStoreRedis } from "../infra/job-store.redis"
import type { UploadMetadataStoreRedis } from "../infra/upload-metadata-store"
import type { UploadObjectStoreS3 } from "../infra/upload-object-store.s3"
import type { SharpImageProcessor } from "../services/image-processor.sharp"
import { UploadFinalizationWorker } from "../services/upload.worker"

export function createUploadWorker(
  config: AppConfig,
  core: CoreServices,
  deps: {
    jobStore: JobStoreRedis
    metadataStore: UploadMetadataStoreRedis
    objectStore: UploadObjectStoreS3
    imageProcessor: SharpImageProcessor
  },
): UploadFinalizationWorker {
  const idleBackoff = createBackoff({
    delay: exponential({
      base: { milliseconds: config.uploads.worker.idleBackoff.baseMs },
      factor: config.uploads.worker.idleBackoff.factor,
    }),
    min: { milliseconds: config.uploads.worker.idleBackoff.minMs },
    max: { milliseconds: config.uploads.worker.idleBackoff.maxMs },
    jitter: decorrelatedJitter({
      min: { milliseconds: config.uploads.worker.idleBackoff.jitterMinMs },
    }),
  })

  const ioBackoff = createBackoff({
    delay: exponential({
      base: { milliseconds: config.uploads.worker.ioRetry.baseMs },
      factor: config.uploads.worker.ioRetry.factor,
    }),
    min: { milliseconds: config.uploads.worker.ioRetry.minMs },
    max: { milliseconds: config.uploads.worker.ioRetry.maxMs },
    jitter: decorrelatedJitter({
      min: { milliseconds: config.uploads.worker.ioRetry.jitterMinMs },
    }),
  })

  return new UploadFinalizationWorker(
    {
      clock: core.clock,
      retryExecutor: core.retryExecutor,
      jobStore: deps.jobStore,
      uploadMetadataStore: deps.metadataStore,
      uploadObjectStore: deps.objectStore,
      imageProcessor: deps.imageProcessor,
    },
    {
      concurrency: config.uploads.worker.concurrency,
      capacityPollMs: config.uploads.worker.capacityPollMs,
      drainPollMs: config.uploads.worker.drainPollMs,
      idleBackoff,
      ioRetryConfig: {
        maxAttempts: config.uploads.worker.ioRetry.maxAttempts,
        delay: ioBackoff,
        ...(config.uploads.worker.ioRetry.maxElapsedMs !== undefined && {
          maxElapsedMs: config.uploads.worker.ioRetry.maxElapsedMs,
        }),
      },
      jobRetryDelay: exponential({
        base: { milliseconds: config.uploads.worker.jobRetry.baseMs },
        factor: config.uploads.worker.jobRetry.factor,
      }),
      maxJobAttempts: config.uploads.worker.jobRetry.maxAttempts,
    },
  )
}
