export { S3Client } from "@aws-sdk/client-s3"
export { Storage as GcsClient } from "@google-cloud/storage"
export {
  type CreateFsStorageOptions,
  type CreateGcsStorageOptions,
  type CreateMemoryStorageOptions,
  type CreateS3StorageOptions,
  createFsStorage,
  createGcsStorage,
  createMemoryStorage,
  createS3Storage,
} from "./adapters/create"
export type { StoragePort } from "./ports/storage"
export type {
  Bytes,
  ObjectRef,
  StorageBucket,
  StorageData,
  StorageKey,
  StorageObject,
  StorageObjectMetadata,
} from "./ports/storage-object"
export type {
  CopyOptions,
  ListOptions,
  PresignedUrlOptions,
  PutInput,
  PutOptions,
} from "./ports/storage-options"
export type { ListResult } from "./ports/storage-result"
