import { createHash } from "node:crypto"
import { Readable } from "node:stream"
import type { Clock } from "@subspace/clock"
import type { StoragePort } from "../ports/storage"
import type {
  ObjectRef,
  StorageBucket,
  StorageData,
  StorageKey,
  StorageObject,
  StorageObjectMetadata,
} from "../ports/storage-object"
import type { CopyOptions, ListOptions, PutOptions } from "../ports/storage-options"
import type { ListResult } from "../ports/storage-result"

interface StoredObject {
  data: Buffer
  contentType?: string
  metadata?: Record<string, string>
  lastModified: Date
}

export interface MemoryStorageDeps {
  clock: Clock
}

export class MemoryStorage implements StoragePort {
  private readonly buckets = new Map<StorageBucket, Map<StorageKey, StoredObject>>()

  constructor(private readonly deps: MemoryStorageDeps) {}

  async put(ref: ObjectRef, data: StorageData, options?: PutOptions): Promise<void> {
    const buffer = await this.toBuffer(data)
    const bucket = this.getOrCreateBucket(ref.bucket)

    bucket.set(ref.key, {
      data: buffer,
      lastModified: this.deps.clock.now(),
      ...(options?.contentType && { contentType: options.contentType }),
      ...(options?.metadata && { metadata: { ...options.metadata } }),
    })
  }

  async head(ref: ObjectRef): Promise<StorageObjectMetadata | null> {
    const stored = this.getStoredObject(ref)
    if (!stored) return null

    return this.toObjectMetadata(ref.key, stored)
  }

  async exists(ref: ObjectRef): Promise<boolean> {
    return this.getStoredObject(ref) !== undefined
  }

  async get(ref: ObjectRef): Promise<StorageObject | null> {
    const stored = this.getStoredObject(ref)
    if (!stored) return null

    return {
      ...this.toObjectMetadata(ref.key, stored),
      body: Readable.from([Buffer.from(stored.data)]),
    }
  }

  async delete(ref: ObjectRef): Promise<void> {
    this.buckets.get(ref.bucket)?.delete(ref.key)
  }

  async deleteMany(bucket: StorageBucket, keys: StorageKey[]): Promise<void> {
    const bucketMap = this.buckets.get(bucket)
    if (!bucketMap) return

    for (const key of keys) {
      bucketMap.delete(key)
    }
  }

  async list(bucket: StorageBucket, options?: ListOptions): Promise<ListResult> {
    const bucketMap = this.buckets.get(bucket)
    if (!bucketMap) return { objects: [], prefixes: [] }

    const prefix = options?.prefix ?? ""
    const delimiter = options?.delimiter
    const maxKeys = options?.maxKeys ?? 1000

    const keys = this.getFilteredSortedKeys(bucketMap, prefix, options?.cursor)

    const objects: StorageObjectMetadata[] = []
    const prefixes: string[] = []
    const seenPrefixes = new Set<string>()

    let cursor: string | undefined

    for (const key of keys) {
      if (objects.length + prefixes.length >= maxKeys) {
        cursor = key
        break
      }

      if (delimiter) {
        const commonPrefix = this.extractCommonPrefix(key, prefix, delimiter)
        if (commonPrefix && !seenPrefixes.has(commonPrefix)) {
          seenPrefixes.add(commonPrefix)
          prefixes.push(commonPrefix)
          continue
        }
        if (commonPrefix) continue
      }

      const stored = bucketMap.get(key)
      if (!stored) continue

      objects.push(this.toObjectMetadata(key, stored))
    }

    return {
      objects,
      prefixes: prefixes.sort(),
      ...(cursor && { cursor }),
    }
  }

  async copy(src: ObjectRef, dst: ObjectRef, options?: CopyOptions): Promise<void> {
    const srcStored = this.getStoredObject(src)
    if (!srcStored) {
      throw new Error(`Source object not found: ${src.bucket}/${src.key}`)
    }

    const dstBucket = this.getOrCreateBucket(dst.bucket)

    dstBucket.set(dst.key, {
      data: Buffer.from(srcStored.data),
      lastModified: this.deps.clock.now(),
      ...(srcStored.contentType && { contentType: srcStored.contentType }),
      ...(options?.metadata
        ? { metadata: { ...options.metadata } }
        : srcStored.metadata
          ? { metadata: { ...srcStored.metadata } }
          : {}),
    })
  }

  async getPresignedUploadUrl(ref: ObjectRef): Promise<URL> {
    return new URL(`memory://${ref.bucket}/${ref.key}?action=upload`)
  }

  async getPresignedDownloadUrl(ref: ObjectRef): Promise<URL> {
    return new URL(`memory://${ref.bucket}/${ref.key}?action=download`)
  }

  private getOrCreateBucket(bucket: StorageBucket): Map<StorageKey, StoredObject> {
    let bucketMap = this.buckets.get(bucket)
    if (!bucketMap) {
      bucketMap = new Map()
      this.buckets.set(bucket, bucketMap)
    }
    return bucketMap
  }

  private getStoredObject(ref: ObjectRef): StoredObject | undefined {
    return this.buckets.get(ref.bucket)?.get(ref.key)
  }

  private toObjectMetadata(key: string, stored: StoredObject): StorageObjectMetadata {
    return {
      key,
      sizeInBytes: stored.data.length,
      lastModified: stored.lastModified,
      etag: this.computeEtag(stored.data),
      ...(stored.contentType && { contentType: stored.contentType }),
      ...(stored.metadata && { metadata: { ...stored.metadata } }),
    }
  }

  private getFilteredSortedKeys(
    bucketMap: Map<StorageKey, StoredObject>,
    prefix: string,
    cursor?: string,
  ): string[] {
    const keys = Array.from(bucketMap.keys())
      .filter((key) => key.startsWith(prefix))
      .sort()

    if (!cursor) return keys

    const startIndex = this.findFirstGreaterThan(keys, cursor)
    return keys.slice(startIndex)
  }

  private findFirstGreaterThan(sortedKeys: string[], value: string): number {
    let lo = 0
    let hi = sortedKeys.length

    while (lo < hi) {
      const mid = (lo + hi) >> 1

      const midValue = sortedKeys[mid]
      if (midValue === undefined) break

      if (midValue <= value) {
        lo = mid + 1
      } else {
        hi = mid
      }
    }

    return lo
  }

  private extractCommonPrefix(
    key: string,
    prefix: string,
    delimiter: string,
  ): string | null {
    const relativePath = key.slice(prefix.length)
    const delimiterIndex = relativePath.indexOf(delimiter)

    if (delimiterIndex < 0) return null

    return prefix + relativePath.slice(0, delimiterIndex + 1)
  }

  private async toBuffer(data: StorageData): Promise<Buffer> {
    if (Buffer.isBuffer(data)) return Buffer.from(data)
    if (data instanceof Uint8Array) return Buffer.from(data)

    const chunks: Buffer[] = []
    for await (const chunk of data as Readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }

    return Buffer.concat(chunks)
  }

  private computeEtag(data: Buffer): string {
    return `"${createHash("md5").update(data).digest("hex")}"`
  }
}
