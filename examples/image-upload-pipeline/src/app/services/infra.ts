import { createRedisClient, type RedisBytesClient } from "@subspace/kv"
import { createS3Storage, S3Client, type StoragePort } from "@subspace/storage"
import type { AppConfig } from "../config"
import type { CoreServices } from "./core"

export type InfraServices = {
  redisClient: RedisBytesClient
  objectStorage: StoragePort
}

export function createInfraServices(
  config: AppConfig,
  core: CoreServices,
): InfraServices {
  const s3Client = new S3Client({
    region: config.s3.region,
    ...(config.s3.endpoint && { endpoint: config.s3.endpoint }),
  })

  const objectStorage = createS3Storage({
    client: s3Client,
    clock: core.clock,
    keyspacePrefix: config.s3.keyPrefix,
  })

  const redisClient = createRedisClient({
    url: config.redis.url,
  })

  return { redisClient, objectStorage }
}
