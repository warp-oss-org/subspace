import type { Clock } from "@subspace/clock"
import {
  createRedisKeyValueStore,
  createRedisKeyValueStoreCas,
  createRedisKeyValueStoreCasAndConditional,
} from "@subspace/kv"
import type { AppConfig } from "../../../app/config"
import type { CoreServices } from "../../../app/services/core"
import type { InfraServices } from "../../../app/services/infra"
import { createJsonCodec } from "../../../lib/codec"
import { type JobIndex, JobStoreRedis } from "../infra/job-store.redis"
import { UploadMetadataStoreRedis } from "../infra/upload-metadata-store"
import { UploadObjectStoreS3 } from "../infra/upload-object-store.s3"
import type { ImageProcessor } from "../model/image.processing.model"
import type { FinalizeJob } from "../model/job.model"
import type { UploadRecord } from "../model/upload.model"
import { SharpImageProcessor } from "../services/image-processor.sharp"
import type { UploadFinalizationWorker } from "../services/upload.worker"
import { createUploadWorker } from "./worker-factory"

export type UploadServices = {
  clock: Clock
  metadataStore: UploadMetadataStoreRedis
  objectStore: UploadObjectStoreS3
  jobStore: JobStoreRedis
  imageProcessor: ImageProcessor
  worker: UploadFinalizationWorker
}

export function createUploadServices(
  config: AppConfig,
  core: CoreServices,
  infra: InfraServices,
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

  const metadataStore = new UploadMetadataStoreRedis({ uploadKv: uploadMetaKv })

  const jobStore = new JobStoreRedis(
    { jobKv, indexKv },
    { leaseDurationMs: config.uploads.worker.leaseDurationMs },
  )

  const objectStore = new UploadObjectStoreS3(
    { objectStorage: infra.objectStorage },
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

  const worker = createUploadWorker(config, core, {
    jobStore,
    metadataStore,
    objectStore,
    imageProcessor,
  })

  return {
    clock: core.clock,
    metadataStore,
    objectStore,
    jobStore,
    imageProcessor,
    worker,
  }
}
