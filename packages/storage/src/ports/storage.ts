import type {
  ObjectRef,
  StorageBucket,
  StorageData,
  StorageKey,
  StorageObject,
  StorageObjectMetadata,
} from "./storage-object"
import type {
  CopyOptions,
  ListOptions,
  PresignedUrlOptions,
  PutOptions,
} from "./storage-options"
import type { ListResult } from "./storage-result"

export interface StoragePort {
  /** Upload an object. Overwrites if exists. */
  put(ref: ObjectRef, data: StorageData, options?: PutOptions): Promise<void>

  /** Get object metadata without body. Returns null if not found. */
  head(ref: ObjectRef): Promise<StorageObjectMetadata | null>

  /** `true` if object exists; `false` otherwise. */
  exists(ref: ObjectRef): Promise<boolean>

  /** Get object with body. Returns null if not found. */
  get(ref: ObjectRef): Promise<StorageObject | null>

  /** Delete an object. No-op if not found. */
  delete(ref: ObjectRef): Promise<void>

  /** Delete multiple objects. Silently skips missing keys. */
  deleteMany(bucket: StorageBucket, keys: StorageKey[]): Promise<void>

  /** List objects in a bucket. Use cursor for pagination. */
  list(bucket: StorageBucket, options?: ListOptions): Promise<ListResult>

  /** Copy an object. Optionally replace metadata. */
  copy(src: ObjectRef, dst: ObjectRef, options?: CopyOptions): Promise<void>

  /** Generate a presigned URL for uploading. */
  getPresignedUploadUrl(ref: ObjectRef, options?: PresignedUrlOptions): Promise<URL>

  /** Generate a presigned URL for downloading. */
  getPresignedDownloadUrl(ref: ObjectRef, options?: PresignedUrlOptions): Promise<URL>
}
