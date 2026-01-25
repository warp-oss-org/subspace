import type { S3Client } from "@aws-sdk/client-s3"
import type { Storage as GcsClient } from "@google-cloud/storage"
import type { Clock } from "@subspace/clock"
import type { StoragePort } from "../ports/storage"
import { FileSystemStorage } from "./fs-storage"
import { GcsStorage } from "./gcs-storage"
import { MemoryStorage } from "./memory-storage"
import { S3Storage } from "./s3-storage"

export interface CreateFsStorageOptions {
  rootDir: string
}

export function createFsStorage(options: CreateFsStorageOptions): StoragePort {
  return new FileSystemStorage(options)
}

export interface CreateMemoryStorageOptions {
  clock: Clock
}

export function createMemoryStorage(options: CreateMemoryStorageOptions): StoragePort {
  return new MemoryStorage({ clock: options.clock })
}

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
