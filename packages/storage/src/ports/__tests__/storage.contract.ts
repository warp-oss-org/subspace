import { Readable } from "node:stream"
import type { StoragePort } from "../storage"
import type { StorageBucket } from "../storage-object"

export type Capabilities = {
  supportsPagination?: boolean
}

const DEFAULT_CAPABILITIES: Required<Capabilities> = {
  supportsPagination: true,
}

export const describeStorageContractTests = (
  name: string,
  createAdapter: () => Promise<{
    bucket: string
    storage: StoragePort
  }>,
  capabilitiesOverride?: Capabilities,
  cleanup?: () => Promise<void>,
) => {
  const capabilities: Required<Capabilities> = {
    ...DEFAULT_CAPABILITIES,
    ...(capabilitiesOverride ?? {}),
  }

  describe(`StoragePort contract: ${name}`, () => {
    let storage: StoragePort
    let bucket: StorageBucket

    beforeAll(async () => {
      const setup = await createAdapter()

      storage = setup.storage
      bucket = setup.bucket
    })

    afterAll(async () => {
      await cleanup?.()
    })

    describe("put / get / head / exists", () => {
      it("stores and retrieves an object", async () => {
        const ref = { bucket, key: "contract/basic.txt" }
        const data = Buffer.from("hello world")

        await storage.put(ref, data, { contentType: "text/plain" })

        const obj = await storage.get(ref)
        expect(obj).not.toBeNull()

        expect(obj).toMatchObject({
          key: ref.key,
          contentType: "text/plain",
          sizeInBytes: data.length,
          body: expect.any(Readable),
          lastModified: expect.any(Date),
        })
      })

      it("accepts Readable stream as input", async () => {
        const ref = { bucket, key: "contract/stream-input.txt" }
        const stream = Readable.from(Buffer.from("stream input"))

        await storage.put(ref, stream)

        expect(await storage.exists(ref)).toBe(true)
        const obj = await storage.get(ref)
        expect(obj!.sizeInBytes).toBe(12)
      })

      it("accepts Uint8Array as input", async () => {
        const ref = { bucket, key: "contract/uint8.txt" }
        const data = new Uint8Array([104, 101, 108, 108, 111])

        await storage.put(ref, data)

        const obj = await storage.get(ref)
        expect(obj!.sizeInBytes).toBe(5)
      })

      it("handles empty file", async () => {
        const ref = { bucket, key: "contract/empty.txt" }
        await storage.put(ref, Buffer.alloc(0))

        const obj = await storage.get(ref)
        expect(obj!.sizeInBytes).toBe(0)
      })

      it("handles large file upload", async () => {
        const ref = { bucket, key: "contract/large.bin" }
        const data = Buffer.alloc(10 * 1024 * 1024, "x") // 10MB

        await storage.put(ref, data)

        const meta = await storage.head(ref)
        expect(meta!.sizeInBytes).toBe(10 * 1024 * 1024)
      }, 30000)

      it("head returns metadata without body", async () => {
        const ref = { bucket, key: "contract/head.txt" }
        await storage.put(ref, Buffer.from("head test"))

        const meta = await storage.head(ref)
        expect(meta).not.toBeNull()
        expect(meta!.key).toBe(ref.key)
        expect(meta!.sizeInBytes).toBe(9)
        expect(meta!.lastModified).toBeInstanceOf(Date)
        expect((meta as any).body).toBeUndefined()
      })

      it("exists returns true for existing object", async () => {
        const ref = { bucket, key: "contract/exists.txt" }
        await storage.put(ref, Buffer.from("exists"))

        expect(await storage.exists(ref)).toBe(true)
      })

      it("exists returns false for missing object", async () => {
        const ref = { bucket, key: "contract/does-not-exist.txt" }
        expect(await storage.exists(ref)).toBe(false)
      })

      it("get returns null for missing object", async () => {
        const ref = { bucket, key: "contract/missing.txt" }
        expect(await storage.get(ref)).toBeNull()
      })

      it("head returns null for missing object", async () => {
        const ref = { bucket, key: "contract/missing-head.txt" }
        expect(await storage.head(ref)).toBeNull()
      })

      it("put overwrites existing object", async () => {
        const ref = { bucket, key: "contract/overwrite.txt" }
        await storage.put(ref, Buffer.from("v1"))
        await storage.put(ref, Buffer.from("version2"))

        const obj = await storage.get(ref)
        expect(obj!.sizeInBytes).toBe(8)
      })

      it("preserves custom metadata", async () => {
        const ref = { bucket, key: "contract/metadata.txt" }
        await storage.put(ref, Buffer.from("meta"), {
          metadata: { "x-custom": "value" },
        })

        const meta = await storage.head(ref)
        expect(meta!.metadata?.["x-custom"]).toBe("value")
      })

      it("handles special characters in key", async () => {
        const ref = { bucket, key: "contract/special/chars!@#$%^&()_+-=[]{}|;':\",.txt" }
        await storage.put(ref, Buffer.from("special"))

        expect(await storage.exists(ref)).toBe(true)
      })

      it("handles unicode in key", async () => {
        const ref = { bucket, key: "contract/こんにちは/文件.txt" }
        await storage.put(ref, Buffer.from("unicode"))

        expect(await storage.exists(ref)).toBe(true)
      })
    })

    describe("delete / deleteMany", () => {
      it("deletes an existing object", async () => {
        const ref = { bucket, key: "contract/delete-me.txt" }
        await storage.put(ref, Buffer.from("delete"))

        await storage.delete(ref)

        expect(await storage.exists(ref)).toBe(false)
      })

      it("delete is no-op for missing object", async () => {
        const ref = { bucket, key: "contract/never-existed.txt" }
        await expect(storage.delete(ref)).resolves.not.toThrow()
      })

      it("deleteMany removes multiple objects", async () => {
        const keys = ["contract/dm1.txt", "contract/dm2.txt", "contract/dm3.txt"]
        for (const key of keys) {
          await storage.put({ bucket, key }, Buffer.from(key))
        }

        await storage.deleteMany(bucket, keys)

        for (const key of keys) {
          expect(await storage.exists({ bucket, key })).toBe(false)
        }
      })

      it("deleteMany silently skips missing keys", async () => {
        await expect(
          storage.deleteMany(bucket, ["contract/missing1.txt", "contract/missing2.txt"]),
        ).resolves.not.toThrow()
      })

      it("deleteMany with empty array is no-op", async () => {
        await expect(storage.deleteMany(bucket, [])).resolves.not.toThrow()
      })
    })

    describe("list", () => {
      beforeAll(async () => {
        await storage.put({ bucket, key: "list/a.txt" }, Buffer.from("a"))
        await storage.put({ bucket, key: "list/b.txt" }, Buffer.from("b"))
        await storage.put({ bucket, key: "list/nested/c.txt" }, Buffer.from("c"))
      })

      it("lists all objects with prefix", async () => {
        const result = await storage.list(bucket, { prefix: "list/" })
        expect(result.objects.length).toBeGreaterThanOrEqual(3)
      })

      it("supports delimiter for folder-style listing", async () => {
        const result = await storage.list(bucket, { prefix: "list/", delimiter: "/" })

        const keys = result.objects.map((o) => o.key)
        expect(keys).toContain("list/a.txt")
        expect(keys).toContain("list/b.txt")
        expect(keys).not.toContain("list/nested/c.txt")
        expect(result.prefixes).toContain("list/nested/")
      })

      it("respects maxKeys", async () => {
        const result = await storage.list(bucket, { prefix: "list/", maxKeys: 1 })
        expect(result.objects.length).toBe(1)
      })

      it.skipIf(capabilities.supportsPagination === false)(
        "paginates with cursor",
        async () => {
          const page1 = await storage.list(bucket, { prefix: "list/", maxKeys: 1 })
          expect(page1.cursor).toBeDefined()

          const page2 = await storage.list(bucket, {
            prefix: "list/",
            cursor: page1.cursor!,
          })
          expect(page2.objects[0]!.key).not.toBe(page1.objects[0]!.key)
        },
      )

      it("returns empty for no matches", async () => {
        const result = await storage.list(bucket, { prefix: "nonexistent-prefix/" })
        expect(result.objects).toEqual([])
        expect(result.cursor).toBeUndefined()
      })
    })

    describe("copy", () => {
      it("copies an object to a new key", async () => {
        const src = { bucket, key: "contract/copy-src.txt" }
        const dst = { bucket, key: "contract/copy-dst.txt" }
        await storage.put(src, Buffer.from("copy me"))

        await storage.copy(src, dst)

        expect(await storage.exists(dst)).toBe(true)
        const obj = await storage.get(dst)
        expect(obj!.sizeInBytes).toBe(7)
      })

      it("preserves metadata by default", async () => {
        const src = { bucket, key: "contract/copy-meta-src.txt" }
        const dst = { bucket, key: "contract/copy-meta-dst.txt" }
        await storage.put(src, Buffer.from("meta"), { metadata: { foo: "bar" } })

        await storage.copy(src, dst)

        const meta = await storage.head(dst)
        expect(meta!.metadata?.foo).toBe("bar")
      })

      it("replaces metadata when provided", async () => {
        const src = { bucket, key: "contract/copy-replace-src.txt" }
        const dst = { bucket, key: "contract/copy-replace-dst.txt" }
        await storage.put(src, Buffer.from("x"), { metadata: { old: "value" } })

        await storage.copy(src, dst, { metadata: { new: "value" } })

        const meta = await storage.head(dst)
        expect(meta!.metadata?.new).toBe("value")
        expect(meta!.metadata?.old).toBeUndefined()
      })

      it("copy to same key with metadata change succeeds", async () => {
        const ref = { bucket, key: "contract/copy-self.txt" }
        await storage.put(ref, Buffer.from("original"), { metadata: { v: "1" } })

        await storage.copy(ref, ref, { metadata: { v: "2" } })

        const meta = await storage.head(ref)
        expect(meta!.metadata?.v).toBe("2")
      })

      it("copy throws on missing source", async () => {
        const src = { bucket, key: "contract/copy-missing-src.txt" }
        const dst = { bucket, key: "contract/copy-missing-dst.txt" }

        await expect(storage.copy(src, dst)).rejects.toThrow()
      })
    })

    describe("presigned URLs", () => {
      it("generates a presigned download URL", async () => {
        const ref = { bucket, key: "contract/presign-dl.txt" }
        await storage.put(ref, Buffer.from("download me"))

        const url = await storage.getPresignedDownloadUrl(ref)
        expect(url).toBeInstanceOf(URL)
        expect(url.href).toContain(ref.key)
      })

      it("generates a presigned upload URL", async () => {
        const ref = { bucket, key: "contract/presign-ul.txt" }

        const url = await storage.getPresignedUploadUrl(ref)
        expect(url).toBeInstanceOf(URL)
      })

      it("respects expiresInSeconds option", async () => {
        const ref = { bucket, key: "contract/presign-expires.txt" }
        await storage.put(ref, Buffer.from("x"))

        const url = await storage.getPresignedDownloadUrl(ref, { expiresInSeconds: 60 })
        expect(url.href).toMatch(/expires|Expires|X-Amz-Expires|X-Goog-Expires/i)
      })
    })
  })
}
