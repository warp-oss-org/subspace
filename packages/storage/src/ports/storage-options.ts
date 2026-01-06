import type { Seconds } from "@subspace/clock"
import type { StorageData, StorageKey } from "./storage-object"

export interface PutOptions {
  contentType?: string
  metadata?: Record<string, string>
}

export interface PutInput {
  key: StorageKey
  data: StorageData
  options?: PutOptions
}

export interface ListOptions {
  /** Filter to objects starting with this prefix (e.g., "users/123/") */
  prefix?: string

  /** Delimiter for folder-style listing (typically "/") */
  delimiter?: string

  /** Max objects to return per page */
  maxKeys?: number

  /** Opaque token from previous ListResult for pagination */
  cursor?: string
}

export interface PresignedUrlOptions {
  expiresInSeconds?: Seconds
  contentType?: string
}

export interface CopyOptions {
  metadata?: Record<string, string>
}
