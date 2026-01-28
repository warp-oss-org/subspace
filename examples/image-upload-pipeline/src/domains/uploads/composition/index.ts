import type { Clock } from "@subspace/clock"
import {
  createRedisKeyValueStore,
  createRedisKeyValueStoreCas,
  createRedisKeyValueStoreCasAndConditional,
} from "@subspace/kv"
import { createS3Storage } from "@subspace/storage"
import type { AppConfig } from "../../../app/config"
import type { CoreServices } from "../../../app/services/core"
import type { InfraClients } from "../../../app/services/infra"
import { createJsonCodec } from "../../../lib/codec"
import type { ImageProcessor } from "../model/image.processing.model"
import type { FinalizeJob } from "../model/job.model"
import type { UploadRecord } from "../model/upload.model"
import { SharpImageProcessor } from "../services/image-processor.sharp"
import { type JobIndex, JobStore } from "../services/job-store"
import type { UploadFinalizationWorker } from "../services/upload.worker"
import { UploadMetadataStore } from "../services/upload-metadata-store"
import { UploadObjectStore } from "../services/upload-object-store"
import { UploadOrchestrator } from "../services/upload-orchestrator"
import { createUploadWorker } from "./worker-factory"

export type UploadServices = {
  clock: Clock
  uploadOrchestrator: UploadOrchestrator
  imageProcessor: ImageProcessor
  worker: UploadFinalizationWorker
}

export function createUploadServices(
  config: AppConfig,
  core: CoreServices,
  infra: InfraClients,
): UploadServices {
  const uploadMetaKv = createRedisKeyValueStoreCasAndConditional<UploadRecord>({
    client: infra.redisClient,
    codec: createJsonCodec<UploadRecord>(),
    opts: {
      batchSize: 100,
      keyspacePrefix: `${config.redis.keyPrefix}:uploads:metadata`,
    },
  })

  const jobKv = createRedisKeyValueStoreCas<FinalizeJob>({
    client: infra.redisClient,
    codec: createJsonCodec<FinalizeJob>(),
    opts: {
      batchSize: 100,
      keyspacePrefix: `${config.redis.keyPrefix}:uploads:jobs`,
    },
  })

  const indexKv = createRedisKeyValueStore<JobIndex>({
    client: infra.redisClient,
    codec: createJsonCodec<JobIndex>(),
    opts: {
      batchSize: 100,
      keyspacePrefix: `${config.redis.keyPrefix}:uploads:job-index`,
    },
  })

  const s3Storage = createS3Storage({
    client: infra.s3Client,
    clock: core.clock,
    keyspacePrefix: config.s3.keyPrefix,
  })

  const metadataStore = new UploadMetadataStore({ uploadKv: uploadMetaKv })

  const jobStore = new JobStore(
    { jobKv, indexKv },
    { leaseDurationMs: config.uploads.worker.leaseDurationMs },
  )

  const objectStore = new UploadObjectStore(
    { objectStorage: s3Storage },
    {
      bucket: config.s3.bucket,
      stagingPrefix: config.uploads.storage.stagingPrefix,
      finalPrefix: config.uploads.storage.finalPrefix,
    },
  )

  const imageProcessor = new SharpImageProcessor({
    thumbnail: config.uploads.images.thumbnail,
    preview: config.uploads.images.preview,
  })

  const uploadOrchestrator = new UploadOrchestrator({
    clock: core.clock,
    metadataStore,
    jobStore,
    objectStore,
    imageProcessor,
    stagingLocation: {
      bucket: config.s3.bucket,
      key: config.uploads.storage.stagingPrefix,
    },
    presignedUrlExpirySeconds: config.uploads.api.presignExpirySeconds,
  })

  const worker = createUploadWorker(config, core, {
    jobStore,
    uploadOrchestrator,
    imageProcessor,
  })

  return {
    clock: core.clock,
    uploadOrchestrator,
    imageProcessor,
    worker,
  }
}
