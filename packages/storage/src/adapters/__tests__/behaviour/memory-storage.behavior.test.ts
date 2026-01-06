import { Readable } from "node:stream"
import { SystemClock } from "@subspace/clock"
import { MemoryStorage } from "../../memory-storage"

describe("MemoryStorageAdapter behavior", () => {
  let storage: MemoryStorage

  beforeEach(() => {
    storage = new MemoryStorage({ clock: new SystemClock() })
  })

  describe("bucket isolation", () => {
    it("isolates data between buckets", async () => {
      await storage.put({ bucket: "a", key: "file.txt" }, Buffer.from("a"))
      await storage.put({ bucket: "b", key: "file.txt" }, Buffer.from("bb"))

      const objA = await storage.get({ bucket: "a", key: "file.txt" })
      const objB = await storage.get({ bucket: "b", key: "file.txt" })

      expect(objA!.sizeInBytes).toBe(1)
      expect(objB!.sizeInBytes).toBe(2)
    })
  })

  describe("body", () => {
    it("returns Readable stream body", async () => {
      const ref = { bucket: "test", key: "buf.txt" }
      await storage.put(ref, Buffer.from("buffer"))

      const obj = await storage.get(ref)
      expect(obj).not.toBeNull()
      expect(obj!.body).toBeInstanceOf(Readable)
    })
  })

  describe("presigned URL scheme", () => {
    it("uses memory:// scheme", async () => {
      const ref = { bucket: "test", key: "presign.txt" }
      await storage.put(ref, Buffer.from("x"))

      const url = await storage.getPresignedDownloadUrl(ref)
      expect(url.protocol).toBe("memory:")
    })
  })

  describe("concurrency", () => {
    it("handles concurrent puts to same key", async () => {
      const ref = { bucket: "test", key: "concurrent.txt" }

      await Promise.all([
        storage.put(ref, Buffer.from("a")),
        storage.put(ref, Buffer.from("bb")),
        storage.put(ref, Buffer.from("ccc")),
      ])

      const obj = await storage.get(ref)
      expect([1, 2, 3]).toContain(obj!.sizeInBytes)
    })
  })
})
