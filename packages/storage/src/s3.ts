import type { S3Client } from "@aws-sdk/client-s3"
import type { Clock } from "@subspace-kit/clock"
import { S3Storage } from "./adapters/s3-storage"
import type { StoragePort } from "./ports/storage"

export {
  S3Storage,
  type S3StorageDeps,
  type S3StorageOptions,
} from "./adapters/s3-storage"

export interface CreateS3StorageOptions {
  client: S3Client
  clock: Clock
  keyspacePrefix: string
  deleteBatchSize?: number
}

export function createS3Storage(options: CreateS3StorageOptions): StoragePort {
  return new S3Storage(
    { client: options.client, clock: options.clock },
    {
      keyspacePrefix: options.keyspacePrefix,
      ...(options.deleteBatchSize !== undefined && {
        deleteBatchSize: options.deleteBatchSize,
      }),
    },
  )
}
