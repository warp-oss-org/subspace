import { createHash } from "node:crypto"
import * as fsSync from "node:fs"
import { createReadStream } from "node:fs"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import type { StoragePort } from "../ports/storage"
import type {
  ObjectRef,
  Metadata as SidecarMetadata,
  StorageBucket,
  StorageData,
  StorageKey,
  StorageObject,
  StorageObjectMetadata,
} from "../ports/storage-object"
import type { CopyOptions, ListOptions, PutOptions } from "../ports/storage-options"
import type { ListResult } from "../ports/storage-result"

export interface FsStorageOptions {
  rootDir: string
}

export class FileSystemStorage implements StoragePort {
  private readonly rootDir: string

  constructor(options: FsStorageOptions) {
    this.rootDir = path.resolve(options.rootDir)
  }

  async put(ref: ObjectRef, data: StorageData, options?: PutOptions): Promise<void> {
    const filePath = this.resolveFilePath(ref)
    await fs.mkdir(path.dirname(filePath), { recursive: true })

    const etag = await this.writeDataAndComputeEtag(filePath, data)

    const sidecar: SidecarMetadata = {
      etag,
      ...(options?.contentType && { contentType: options.contentType }),
      ...(options?.metadata && { metadata: { ...options.metadata } }),
    }

    await fs.writeFile(this.getSidecarPath(filePath), JSON.stringify(sidecar, null, 2))
  }

  async head(ref: ObjectRef): Promise<StorageObjectMetadata | null> {
    const filePath = this.resolveFilePath(ref)

    try {
      const stat = await fs.stat(filePath)
      const sidecar = await this.loadSidecar(filePath)
      const etag = sidecar?.etag ?? (await this.computeEtag(filePath))

      return {
        key: ref.key,
        sizeInBytes: stat.size,
        lastModified: stat.mtime,
        etag,
        ...(sidecar?.contentType && { contentType: sidecar.contentType }),
        ...(sidecar?.metadata && { metadata: { ...sidecar.metadata } }),
      }
    } catch (err) {
      if (this.isNotFoundError(err)) return null
      throw err
    }
  }

  async exists(ref: ObjectRef): Promise<boolean> {
    const filePath = this.resolveFilePath(ref)

    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  async get(ref: ObjectRef): Promise<StorageObject | null> {
    const filePath = this.resolveFilePath(ref)

    try {
      const stat = await fs.stat(filePath)
      const sidecar = await this.loadSidecar(filePath)
      const etag = sidecar?.etag ?? (await this.computeEtag(filePath))

      return {
        key: ref.key,
        sizeInBytes: stat.size,
        lastModified: stat.mtime,
        etag,
        body: createReadStream(filePath),
        ...(sidecar?.contentType && { contentType: sidecar.contentType }),
        ...(sidecar?.metadata && { metadata: { ...sidecar.metadata } }),
      }
    } catch (err) {
      if (this.isNotFoundError(err)) return null
      throw err
    }
  }

  async delete(ref: ObjectRef): Promise<void> {
    const filePath = this.resolveFilePath(ref)

    await this.unlinkSafe(filePath)
    await this.unlinkSafe(this.getSidecarPath(filePath))
  }

  async deleteMany(bucket: StorageBucket, keys: StorageKey[]): Promise<void> {
    await Promise.all(keys.map((key) => this.delete({ bucket, key })))
  }

  async list(bucket: StorageBucket, options?: ListOptions): Promise<ListResult> {
    const bucketDir = path.join(this.rootDir, bucket)
    const prefix = options?.prefix ?? ""
    const delimiter = options?.delimiter
    const maxKeys = options?.maxKeys ?? 1000

    try {
      const allKeys = await this.walkDirectory(bucketDir)
      const filteredKeys = allKeys
        .filter((key) => key.startsWith(prefix) && !key.endsWith(".meta.json"))
        .sort()

      const keys = this.applyCursor(filteredKeys, options?.cursor)

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

        const meta = await this.head({ bucket, key })
        if (meta) objects.push(meta)
      }

      return {
        objects,
        prefixes: prefixes.sort(),
        ...(cursor && { cursor }),
      }
    } catch (err) {
      if (this.isNotFoundError(err)) return { objects: [], prefixes: [] }
      throw err
    }
  }

  async copy(src: ObjectRef, dst: ObjectRef, options?: CopyOptions): Promise<void> {
    const srcPath = this.resolveFilePath(src)
    const dstPath = this.resolveFilePath(dst)

    await fs.mkdir(path.dirname(dstPath), { recursive: true })
    await fs.copyFile(srcPath, dstPath)

    const srcSidecar = await this.loadSidecar(srcPath)
    const etag = srcSidecar?.etag ?? (await this.computeEtag(srcPath))
    const meta = options?.metadata
      ? { ...options.metadata }
      : srcSidecar?.metadata
        ? { ...srcSidecar.metadata }
        : undefined

    const dstSidecar: SidecarMetadata = {
      etag,
      ...(srcSidecar?.contentType && { contentType: srcSidecar.contentType }),
      ...(meta && { metadata: meta }),
    }

    await fs.writeFile(this.getSidecarPath(dstPath), JSON.stringify(dstSidecar, null, 2))
  }

  async getPresignedUploadUrl(ref: ObjectRef): Promise<URL> {
    return new URL(`file://${this.resolveFilePath(ref)}`)
  }

  async getPresignedDownloadUrl(ref: ObjectRef): Promise<URL> {
    return new URL(`file://${this.resolveFilePath(ref)}`)
  }

  private resolveFilePath(ref: ObjectRef): string {
    this.validateKey(ref.key)

    const sanitizedKey = ref.key.split("/").map(encodeURIComponent).join("/")
    const bucketDir = path.join(this.rootDir, ref.bucket)
    const filePath = path.join(bucketDir, sanitizedKey)

    const resolvedBucketDir = path.resolve(bucketDir) + path.sep
    const resolvedFilePath = path.resolve(filePath)

    if (!resolvedFilePath.startsWith(resolvedBucketDir)) {
      throw new Error("Resolved storage path escapes bucket directory")
    }

    return filePath
  }

  private getSidecarPath(filePath: string): string {
    return `${filePath}.meta.json`
  }

  private validateKey(key: string): void {
    if (key.startsWith("/")) {
      throw new Error("Storage key must not start with '/'")
    }
    if (key.includes("\\")) {
      throw new Error("Storage key must not contain backslashes")
    }

    const segments = key.split("/")
    if (segments.length === 0 || segments.some((s) => !s)) {
      throw new Error("Storage key must not be empty or contain empty segments")
    }
    if (segments.some((s) => s === "." || s === "..")) {
      throw new Error("Storage key must not contain '.' or '..' segments")
    }
  }

  private async writeDataAndComputeEtag(
    filePath: string,
    data: StorageData,
  ): Promise<string> {
    if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
      const buffer = Buffer.from(data)
      await fs.writeFile(filePath, buffer)
      return `"${createHash("md5").update(buffer).digest("hex")}"`
    }

    const writeStream = fsSync.createWriteStream(filePath)
    await pipeline(data as Readable, writeStream)

    return this.computeEtag(filePath)
  }

  private async computeEtag(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath)
    return `"${createHash("md5").update(content).digest("hex")}"`
  }

  private async loadSidecar(filePath: string): Promise<SidecarMetadata | null> {
    try {
      const content = await fs.readFile(this.getSidecarPath(filePath), "utf-8")
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  private async unlinkSafe(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath)
    } catch (err) {
      if (!this.isNotFoundError(err)) throw err
    }
  }

  private async walkDirectory(dir: string, prefix = ""): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const files: string[] = []

    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        const subFiles = await this.walkDirectory(
          path.join(dir, entry.name),
          relativePath,
        )
        files.push(...subFiles)
      } else {
        files.push(relativePath)
      }
    }

    return files
  }

  private applyCursor(keys: string[], cursor?: string): string[] {
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

  private isNotFoundError(err: unknown): boolean {
    return (err as NodeJS.ErrnoException).code === "ENOENT"
  }
}
