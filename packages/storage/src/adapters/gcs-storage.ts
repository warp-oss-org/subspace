import type { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import type { File, Storage as GcsClient } from "@google-cloud/storage"
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
import type {
  CopyOptions,
  ListOptions,
  PresignedUrlOptions,
  PutOptions,
} from "../ports/storage-options"
import type { ListResult } from "../ports/storage-result"

const DEFAULT_PRESIGN_EXPIRY_SECONDS = 3600
const DEFAULT_DELETE_BATCH_SIZE = 100

type ListApiResponse = {
  prefixes?: string[]
  nextPageToken?: string
}

export interface GcsStorageDeps {
  client: GcsClient
  clock: Clock
}

export interface GcsStorageOptions {
  keyspacePrefix: string
  defaultExpiresInSeconds?: number
  deleteBatchSize?: number
}

export class GcsStorage implements StoragePort {
  constructor(
    private readonly deps: GcsStorageDeps,
    private readonly options: GcsStorageOptions,
  ) {}

  async put(ref: ObjectRef, data: StorageData, options?: PutOptions): Promise<void> {
    const file = this.getFile(ref)

    const uploadMetadata = {
      ...(options?.contentType && { contentType: options.contentType }),
      ...(options?.metadata && { metadata: { ...options.metadata } }),
    }

    const writeStream = file.createWriteStream({
      resumable: true,
      ...(Object.keys(uploadMetadata).length > 0 && { metadata: uploadMetadata }),
    })

    if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
      await this.writeBuffer(writeStream, Buffer.from(data))
    } else {
      await pipeline(data as Readable, writeStream)
    }

    if (Object.keys(uploadMetadata).length > 0) {
      await file.setMetadata(uploadMetadata)
    }
  }

  async head(ref: ObjectRef): Promise<StorageObjectMetadata | null> {
    const file = this.getFile(ref)

    try {
      const [metadata] = await file.getMetadata()
      return this.toObjectMetadata(ref.key, metadata)
    } catch (err) {
      if (this.isNotFoundError(err)) return null
      throw err
    }
  }

  async exists(ref: ObjectRef): Promise<boolean> {
    const file = this.getFile(ref)
    const [exists] = await file.exists()
    return exists
  }

  async get(ref: ObjectRef): Promise<StorageObject | null> {
    const file = this.getFile(ref)

    try {
      const [metadata] = await file.getMetadata()

      return {
        ...this.toObjectMetadata(ref.key, metadata),
        body: file.createReadStream(),
      }
    } catch (err) {
      if (this.isNotFoundError(err)) return null
      throw err
    }
  }

  async delete(ref: ObjectRef): Promise<void> {
    const file = this.getFile(ref)

    try {
      await file.delete()
    } catch (err) {
      if (!this.isNotFoundError(err)) throw err
    }
  }

  async deleteMany(bucket: StorageBucket, keys: StorageKey[]): Promise<void> {
    if (keys.length === 0) return

    const bucketRef = this.deps.client.bucket(bucket)

    for (const batch of this.chunk(
      keys,
      this.options.deleteBatchSize ?? DEFAULT_DELETE_BATCH_SIZE,
    )) {
      await Promise.all(
        batch.map(async (key) => {
          try {
            await bucketRef.file(this.prefixKey(key)).delete()
          } catch (err) {
            if (!this.isNotFoundError(err)) throw err
          }
        }),
      )
    }
  }

  async list(bucket: StorageBucket, options?: ListOptions): Promise<ListResult> {
    const bucketRef = this.deps.client.bucket(bucket)

    const prefix = this.getListPrefix(options?.prefix)

    const [files, , apiResponse] = await bucketRef.getFiles({
      ...(prefix && { prefix }),
      ...(options?.delimiter && { delimiter: options.delimiter }),
      ...(options?.maxKeys && { maxResults: options.maxKeys }),
      ...(options?.cursor && { pageToken: options.cursor }),
      autoPaginate: false,
    })

    const api = this.toListApiResponse(apiResponse)

    const objects = this.mapListFiles(files)
    const prefixes = this.mapListPrefixes(api)

    return {
      objects,
      prefixes,
      ...(api.nextPageToken ? { cursor: api.nextPageToken } : {}),
    }
  }

  async copy(src: ObjectRef, dst: ObjectRef, options?: CopyOptions): Promise<void> {
    const srcFile = this.getFile(src)
    const dstFile = this.getFile(dst)

    const copyOptions = options?.metadata
      ? { metadata: { ...options.metadata } }
      : undefined

    await srcFile.copy(dstFile, copyOptions)
  }

  async getPresignedUploadUrl(
    ref: ObjectRef,
    options?: PresignedUrlOptions,
  ): Promise<URL> {
    const file = this.getFile(ref)
    const expiresInSeconds =
      options?.expiresInSeconds ??
      this.options.defaultExpiresInSeconds ??
      DEFAULT_PRESIGN_EXPIRY_SECONDS

    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: this.deps.clock.now().getTime() + expiresInSeconds * 1000,
      ...(options?.contentType && { contentType: options.contentType }),
    })

    return new URL(url)
  }

  async getPresignedDownloadUrl(
    ref: ObjectRef,
    options?: PresignedUrlOptions,
  ): Promise<URL> {
    const file = this.getFile(ref)
    const expiresInSeconds =
      options?.expiresInSeconds ??
      this.options.defaultExpiresInSeconds ??
      DEFAULT_PRESIGN_EXPIRY_SECONDS

    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: this.deps.clock.now().getTime() + expiresInSeconds * 1000,
    })

    return new URL(url)
  }

  private getFile(ref: ObjectRef): File {
    const prefixedKey = this.prefixKey(ref.key)

    return this.deps.client.bucket(ref.bucket).file(prefixedKey)
  }

  private prefixKey(key: string): string {
    if (!this.options.keyspacePrefix) return key

    const normalizedPrefix = this.options.keyspacePrefix.endsWith("/")
      ? this.options.keyspacePrefix
      : `${this.options.keyspacePrefix}/`

    return `${normalizedPrefix}${key}`
  }

  private stripKeyspacePrefix(key: string): string {
    if (!this.options.keyspacePrefix) return key

    const normalizedPrefix = this.options.keyspacePrefix.endsWith("/")
      ? this.options.keyspacePrefix
      : `${this.options.keyspacePrefix}/`

    return key.startsWith(normalizedPrefix) ? key.slice(normalizedPrefix.length) : key
  }

  private getListPrefix(userPrefix?: string): string | undefined {
    const normalizedKeyspace = this.options.keyspacePrefix
      ? this.options.keyspacePrefix.endsWith("/")
        ? this.options.keyspacePrefix
        : `${this.options.keyspacePrefix}/`
      : ""

    if (userPrefix) return `${normalizedKeyspace}${userPrefix}`
    if (normalizedKeyspace) return normalizedKeyspace

    return undefined
  }

  private toObjectMetadata(
    originalKey: string,
    metadata: unknown,
  ): StorageObjectMetadata {
    const m = this.toRecord(metadata)

    const sizeRaw = m.size
    const sizeInBytes =
      typeof sizeRaw === "string"
        ? parseInt(sizeRaw, 10) || 0
        : typeof sizeRaw === "number"
          ? sizeRaw
          : 0

    const updated = typeof m.updated === "string" ? m.updated : undefined
    const lastModified = this.parseDate(updated) ?? this.deps.clock.now()

    const etag = typeof m.etag === "string" ? m.etag : undefined
    const contentType = typeof m.contentType === "string" ? m.contentType : undefined
    const userMetadata = this.toStringRecord(m.metadata)

    return {
      key: originalKey,
      sizeInBytes,
      lastModified,
      ...(etag ? { etag } : {}),
      ...(contentType ? { contentType } : {}),
      ...(userMetadata ? { metadata: { ...userMetadata } } : {}),
    }
  }

  private mapListFiles(files: File[]): StorageObjectMetadata[] {
    const normalizedPrefix = this.options.keyspacePrefix
      ? this.options.keyspacePrefix.endsWith("/")
        ? this.options.keyspacePrefix
        : `${this.options.keyspacePrefix}/`
      : ""

    return files
      .filter((file) => {
        if (normalizedPrefix && !file.name.startsWith(normalizedPrefix)) return false
        return true
      })
      .map((file) => {
        const md = this.toRecord(file.metadata)

        const sizeRaw = md.size
        const sizeInBytes =
          typeof sizeRaw === "string"
            ? parseInt(sizeRaw, 10) || 0
            : typeof sizeRaw === "number"
              ? sizeRaw
              : 0

        const updated = typeof md.updated === "string" ? md.updated : undefined
        const lastModified = this.parseDate(updated) ?? this.deps.clock.now()

        const etag = typeof md.etag === "string" ? md.etag : undefined
        const contentType =
          typeof md.contentType === "string" ? md.contentType : undefined
        const userMetadata = this.toStringRecord(md.metadata)

        return {
          key: this.stripKeyspacePrefix(file.name),
          sizeInBytes,
          lastModified,
          ...(etag ? { etag } : {}),
          ...(contentType ? { contentType } : {}),
          ...(userMetadata ? { metadata: { ...userMetadata } } : {}),
        }
      })
  }

  private mapListPrefixes(apiResponse: ListApiResponse): string[] {
    const rawPrefixes = apiResponse.prefixes ?? []

    const normalizedKeyspace = this.options.keyspacePrefix
      ? this.options.keyspacePrefix.endsWith("/")
        ? this.options.keyspacePrefix
        : `${this.options.keyspacePrefix}/`
      : ""

    return rawPrefixes
      .filter((p) => (normalizedKeyspace ? p.startsWith(normalizedKeyspace) : true))
      .map((p) => this.stripKeyspacePrefix(p))
  }

  private async writeBuffer(
    writeStream: NodeJS.WritableStream,
    buffer: Buffer,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      writeStream.on("error", reject)
      writeStream.on("finish", resolve)
      writeStream.end(buffer)
    })
  }

  private parseDate(value: string | undefined): Date | null {
    if (!value) return null
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : new Date(parsed)
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object") {
      return value as Record<string, unknown>
    }
    return {}
  }

  private toStringRecord(value: unknown): Record<string, string> | undefined {
    if (!value || typeof value !== "object") return undefined

    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v
    }

    return Object.keys(out).length > 0 ? out : undefined
  }

  private toListApiResponse(value: unknown): ListApiResponse {
    if (!value || typeof value !== "object") return {}

    const v = value as Record<string, unknown>

    const prefixes = Array.isArray(v.prefixes)
      ? v.prefixes.filter((p): p is string => typeof p === "string")
      : undefined

    const nextPageToken =
      typeof v.nextPageToken === "string" ? v.nextPageToken : undefined

    return {
      ...(prefixes ? { prefixes } : {}),
      ...(nextPageToken ? { nextPageToken } : {}),
    }
  }

  private isNotFoundError(err: unknown): boolean {
    const code = this.getErrorCode(err)
    return code === 404 || code === "ENOENT"
  }

  private getErrorCode(err: unknown): unknown {
    if (!err || typeof err !== "object") return undefined

    if ("code" in err) {
      return (err as Record<string, unknown>).code
    }

    return undefined
  }
}
