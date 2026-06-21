import type { Storage as GcsClient } from "@google-cloud/storage"
import type { Clock } from "@subspace/clock"
import { GcsStorage } from "./adapters/gcs-storage"
import type { StoragePort } from "./ports/storage"

export {
  GcsStorage,
  type GcsStorageDeps,
  type GcsStorageOptions,
} from "./adapters/gcs-storage"

export interface CreateGcsStorageOptions {
  client: GcsClient
  clock: Clock
  keyspacePrefix: string
  defaultExpiresInSeconds?: number
  deleteBatchSize?: number
}

export function createGcsStorage(options: CreateGcsStorageOptions): StoragePort {
  return new GcsStorage(
    { client: options.client, clock: options.clock },
    {
      keyspacePrefix: options.keyspacePrefix,
      ...(options.defaultExpiresInSeconds !== undefined && {
        defaultExpiresInSeconds: options.defaultExpiresInSeconds,
      }),
      ...(options.deleteBatchSize !== undefined && {
        deleteBatchSize: options.deleteBatchSize,
      }),
    },
  )
}
