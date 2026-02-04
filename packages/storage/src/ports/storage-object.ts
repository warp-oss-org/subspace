import type { Readable } from "node:stream"

export type StorageData = Readable | Buffer | Uint8Array

export type Bytes = number

/**
 * Unique identifier for an object within a bucket.
 * Typically a path-like string (e.g., "users/123/avatar.png").
 */
export type StorageKey = string

/**
 * Name of a storage bucket.
 * Must conform to provider naming rules (e.g., lowercase, no underscores for S3).
 */
export type StorageBucket = string

/**
 * Pointer to a specific object in storage.
 */
export interface ObjectRef {
  bucket: StorageBucket
  key: StorageKey
}

export type Metadata = {
  contentType?: string
  metadata?: Record<string, string | number | boolean>
  etag?: string
}

/**
 * Object metadata returned by head() and list().
 * Note: metadata may be absent from list() results depending on provider.
 */
export type StorageObjectMetadata = Metadata & {
  key: StorageKey
  sizeInBytes: Bytes
  lastModified: Date
}

/**
 * Full object with body, returned by get().
 */
export interface StorageObject extends StorageObjectMetadata {
  body: Readable | Buffer
}
