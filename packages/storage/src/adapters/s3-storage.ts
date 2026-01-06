import type { Readable } from "node:stream"
import {
  type _Object,
  type CommonPrefix,
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3"
import { Upload } from "@aws-sdk/lib-storage"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import type { Clock } from "@subspace/clock"
import type { StoragePort } from "../ports/storage"
import type {
  ObjectRef,
  StorageBucket,
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

const S3_MAX_DELETE_BATCH_SIZE = 1000
const DEFAULT_DELETE_BATCH_SIZE = 1000

export interface S3StorageDeps {
  client: S3Client
  clock: Clock
}

export interface S3StorageOptions {
  keyspacePrefix: string
  deleteBatchSize?: number
}

export class S3Storage implements StoragePort {
  constructor(
    readonly deps: S3StorageDeps,
    readonly options: S3StorageOptions,
  ) {}

  async put(
    ref: ObjectRef,
    data: Readable | Buffer | Uint8Array,
    options?: PutOptions,
  ): Promise<void> {
    const prefixedRef = this.applyKeyspacePrefix(ref)

    const upload = new Upload({
      client: this.deps.client,
      params: {
        Bucket: prefixedRef.bucket,
        Key: prefixedRef.key,
        Body: data,
        ...(options?.contentType && { ContentType: options.contentType }),
        ...(options?.metadata && { Metadata: options.metadata }),
      },
    })

    await upload.done()
  }

  async head(ref: ObjectRef): Promise<StorageObjectMetadata | null> {
    const prefixedRef = this.applyKeyspacePrefix(ref)

    try {
      const response = await this.deps.client.send(
        new HeadObjectCommand({
          Bucket: prefixedRef.bucket,
          Key: prefixedRef.key,
        }),
      )

      return this.toObjectMetadata(ref.key, response)
    } catch (err) {
      if (this.isNotFoundError(err)) return null
      throw err
    }
  }

  async exists(ref: ObjectRef): Promise<boolean> {
    return (await this.head(ref)) !== null
  }

  async get(ref: ObjectRef): Promise<StorageObject | null> {
    const prefixedRef = this.applyKeyspacePrefix(ref)

    try {
      const response = await this.deps.client.send(
        new GetObjectCommand({
          Bucket: prefixedRef.bucket,
          Key: prefixedRef.key,
        }),
      )

      return {
        ...this.toObjectMetadata(ref.key, response),
        body: response.Body as Readable,
      }
    } catch (err) {
      if (this.isNotFoundError(err)) return null
      throw err
    }
  }

  async delete(ref: ObjectRef): Promise<void> {
    const prefixedRef = this.applyKeyspacePrefix(ref)

    await this.deps.client.send(
      new DeleteObjectCommand({
        Bucket: prefixedRef.bucket,
        Key: prefixedRef.key,
      }),
    )
  }

  async deleteMany(bucket: StorageBucket, keys: StorageKey[]): Promise<void> {
    if (keys.length === 0) return

    const batchSize = Math.min(
      this.options.deleteBatchSize ?? DEFAULT_DELETE_BATCH_SIZE,
      S3_MAX_DELETE_BATCH_SIZE,
    )

    for (const batch of this.chunk(keys, batchSize)) {
      await this.deps.client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: batch.map((key) => ({ Key: this.prefixKey(key) })),
            Quiet: true,
          },
        }),
      )
    }
  }

  async list(bucket: StorageBucket, options?: ListOptions): Promise<ListResult> {
    const response = await this.deps.client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ...(this.getListPrefix(options?.prefix) && {
          Prefix: this.getListPrefix(options?.prefix),
        }),
        ...(options?.delimiter && { Delimiter: options.delimiter }),
        ...(options?.maxKeys && { MaxKeys: options.maxKeys }),
        ...(options?.cursor && { ContinuationToken: options.cursor }),
      }),
    )

    return {
      objects: this.mapListContents(response.Contents),
      prefixes: this.mapListPrefixes(response.CommonPrefixes),
      ...(response.NextContinuationToken && { cursor: response.NextContinuationToken }),
    }
  }

  async copy(src: ObjectRef, dst: ObjectRef, options?: CopyOptions): Promise<void> {
    const prefixedSrc = this.applyKeyspacePrefix(src)
    const prefixedDst = this.applyKeyspacePrefix(dst)
    const copySource = encodeURIComponent(`${prefixedSrc.bucket}/${prefixedSrc.key}`)

    await this.deps.client.send(
      new CopyObjectCommand({
        Bucket: prefixedDst.bucket,
        Key: prefixedDst.key,
        CopySource: copySource,
        ...(options?.metadata
          ? { Metadata: options.metadata, MetadataDirective: "REPLACE" }
          : { MetadataDirective: "COPY" }),
      }),
    )
  }

  async getPresignedUploadUrl(
    ref: ObjectRef,
    options?: PresignedUrlOptions,
  ): Promise<URL> {
    const prefixedRef = this.applyKeyspacePrefix(ref)

    const command = new PutObjectCommand({
      Bucket: prefixedRef.bucket,
      Key: prefixedRef.key,
      ...(options?.contentType && { ContentType: options.contentType }),
    })

    const url = await getSignedUrl(this.deps.client, command, {
      ...(options?.expiresInSeconds && { expiresIn: options.expiresInSeconds }),
    })

    return new URL(url)
  }

  async getPresignedDownloadUrl(
    ref: ObjectRef,
    options?: PresignedUrlOptions,
  ): Promise<URL> {
    const prefixedRef = this.applyKeyspacePrefix(ref)

    const command = new GetObjectCommand({
      Bucket: prefixedRef.bucket,
      Key: prefixedRef.key,
    })

    const url = await getSignedUrl(this.deps.client, command, {
      ...(options?.expiresInSeconds && { expiresIn: options.expiresInSeconds }),
    })

    return new URL(url)
  }

  private applyKeyspacePrefix(ref: ObjectRef): ObjectRef {
    return { bucket: ref.bucket, key: this.prefixKey(ref.key) }
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
    response: {
      ContentLength?: number | undefined
      LastModified?: Date | undefined
      ETag?: string | undefined
      ContentType?: string | undefined
      Metadata?: Record<string, string> | undefined
    },
  ): StorageObjectMetadata {
    return {
      key: originalKey,
      sizeInBytes: response.ContentLength ?? 0,
      lastModified: response.LastModified ?? this.deps.clock.now(),
      ...(response.ETag && { etag: response.ETag }),
      ...(response.ContentType && { contentType: response.ContentType }),
      ...(response.Metadata && { metadata: response.Metadata }),
    }
  }

  private mapListContents(contents: _Object[] | undefined): StorageObjectMetadata[] {
    if (!contents) return []

    const normalizedPrefix = this.options.keyspacePrefix
      ? this.options.keyspacePrefix.endsWith("/")
        ? this.options.keyspacePrefix
        : `${this.options.keyspacePrefix}/`
      : ""

    return contents
      .filter((obj): obj is _Object & { Key: string } => Boolean(obj.Key))
      .filter((obj) => {
        if (normalizedPrefix && !obj.Key.startsWith(normalizedPrefix)) return false
        return true
      })
      .map((obj) => ({
        key: this.stripKeyspacePrefix(obj.Key),
        sizeInBytes: obj.Size ?? 0,
        lastModified: obj.LastModified ?? this.deps.clock.now(),
        ...(obj.ETag && { etag: obj.ETag }),
      }))
  }

  private mapListPrefixes(commonPrefixes: CommonPrefix[] | undefined): string[] {
    if (!commonPrefixes) return []

    return commonPrefixes
      .map((p) => p.Prefix)
      .filter((p): p is string => Boolean(p))
      .map((p) => this.stripKeyspacePrefix(p))
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  private isNotFoundError(err: unknown): boolean {
    const name = (err as Error).name
    return name === "NotFound" || name === "NoSuchKey"
  }
}
