import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { FileSystemStorage } from "../../fs-storage"

describe("FsStorageAdapter behavior", () => {
  let storage: FileSystemStorage
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "subspace-fs-"))
    storage = new FileSystemStorage({ rootDir: tempDir })
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true })
  })

  describe("directory structure", () => {
    it("creates nested directories as needed", async () => {
      const ref = { bucket: "test", key: "deep/nested/path/file.txt" }
      await storage.put(ref, Buffer.from("nested"))

      const filePath = path.join(tempDir, "test", "deep/nested/path/file.txt")
      const stat = await fs.stat(filePath)

      expect(stat.isFile()).toBe(true)
    })

    it("maps bucket to top-level directory", async () => {
      await storage.put({ bucket: "mybucket", key: "file.txt" }, Buffer.from("x"))

      const bucketDir = path.join(tempDir, "mybucket")
      const stat = await fs.stat(bucketDir)

      expect(stat.isDirectory()).toBe(true)
    })
  })

  describe("body format", () => {
    it("returns Readable stream for body", async () => {
      const ref = { bucket: "test", key: "stream.txt" }
      await storage.put(ref, Buffer.from("stream content"))

      const obj = await storage.get(ref)
      expect(obj!.body).toHaveProperty("pipe")
    })
  })

  describe("presigned URL scheme", () => {
    it("uses file:// scheme", async () => {
      const ref = { bucket: "test", key: "presign.txt" }
      await storage.put(ref, Buffer.from("x"))

      const url = await storage.getPresignedDownloadUrl(ref)
      expect(url.protocol).toBe("file:")
    })
  })

  describe("metadata sidecar", () => {
    it("stores metadata in sidecar file", async () => {
      const ref = { bucket: "test", key: "with-meta.txt" }
      await storage.put(ref, Buffer.from("x"), {
        contentType: "text/plain",
        metadata: { custom: "value" },
      })

      const metaPath = path.join(tempDir, "test", "with-meta.txt.meta.json")
      const metaContent = await fs.readFile(metaPath, "utf-8")
      const parsed = JSON.parse(metaContent)

      expect(parsed.contentType).toBe("text/plain")
      expect(parsed.metadata.custom).toBe("value")
    })
  })

  describe("file timestamps", () => {
    it("uses lastModified from file stat", async () => {
      const ref = { bucket: "test", key: "mtime.txt" }
      await storage.put(ref, Buffer.from("mtime"))

      const meta = await storage.head(ref)
      const now = Date.now()

      expect(meta!.lastModified.getTime()).toBeLessThanOrEqual(now)
      expect(meta!.lastModified.getTime()).toBeGreaterThan(now - 5000)
    })
  })

  describe("key validation", () => {
    it("rejects keys starting with '/'", async () => {
      const ref = { bucket: "test", key: "/starts-with-slash" }
      await expect(storage.put(ref, Buffer.from("x"))).rejects.toThrow(
        "Storage key must not start with '/'",
      )
    })

    it("rejects keys containing backslashes", async () => {
      const ref = { bucket: "test", key: "contains\\backslash" }
      await expect(storage.put(ref, Buffer.from("x"))).rejects.toThrow(
        "Storage key must not contain backslashes",
      )
    })

    it("rejects keys with empty segments", async () => {
      const ref = { bucket: "test", key: "a//b" }
      await expect(storage.put(ref, Buffer.from("x"))).rejects.toThrow(
        "Storage key must not be empty or contain empty segments",
      )
    })

    it("rejects keys containing '.' or '..' segments", async () => {
      const ref1 = { bucket: "test", key: "a/./b" }
      const ref2 = { bucket: "test", key: "a/../b" }
      await expect(storage.put(ref1, Buffer.from("x"))).rejects.toThrow(
        "Storage key must not contain '.' or '..' segments",
      )
      await expect(storage.put(ref2, Buffer.from("x"))).rejects.toThrow(
        "Storage key must not contain '.' or '..' segments",
      )
    })
  })

  describe("error handling", () => {
    it("throws on permission denied", async () => {
      const readOnlyDir = path.join(tempDir, "readonly")
      await fs.mkdir(readOnlyDir, { mode: 0o555 })

      const readOnlyStorage = new FileSystemStorage({ rootDir: readOnlyDir })
      const ref = { bucket: "test", key: "denied.txt" }

      await expect(readOnlyStorage.put(ref, Buffer.from("x"))).rejects.toThrow()
    })
  })
})
