import { createRedisClient, type RedisBytesClient } from "@subspace/kv"
import { S3Client } from "@subspace/storage"
import type { AppConfig } from "../config"

export type InfraClients = {
  s3Client: S3Client
  redisClient: RedisBytesClient
}

export function createDefaultInfraClients(config: AppConfig): InfraClients {
  const s3Client = new S3Client({
    region: config.s3.region,
    ...(config.s3.endpoint && { forcePathStyle: true }),
    ...(config.s3.credentials && { credentials: config.s3.credentials }),
    ...(config.s3.endpoint && { endpoint: config.s3.endpoint }),
  })

  const redisClient = createRedisClient({
    url: config.redis.url,
  })

  return { redisClient, s3Client }
}
