import type { S3Client } from "@aws-sdk/client-s3"
import { ListObjectsV2Command } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { SystemClock } from "@subspace/clock"
import { vi } from "vitest"
import { createS3TestClient } from "../../../tests/utils/create-s3-test-client"
import { deleteS3KeysByPrefix } from "../../../tests/utils/delete-s3-keys-by-prefix"
import { ensureS3BucketExists } from "../../../tests/utils/ensure-s3-bucket-exists"
import { S3Storage } from "../../s3-storage"

vi.mock("@aws-sdk/s3-request-presigner", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@aws-sdk/s3-request-presigner")>()
  return {
    ...mod,
    getSignedUrl: vi.fn(),
  }
})

describe("S3Storage (behavior)", () => {
  let client: S3Client
  let keyspacePrefix: string

  let storage: S3Storage

  const TEST_BUCKET = "test-bucket"
  const OTHER_BUCKET = "other-bucket"

  beforeAll(async () => {
    const setup = createS3TestClient()

    client = setup.client
    keyspacePrefix = setup.keyspacePrefix

    await ensureS3BucketExists(client, TEST_BUCKET)
    await ensureS3BucketExists(client, OTHER_BUCKET)

    storage = new S3Storage({ client, clock: new SystemClock() }, { keyspacePrefix })
  })

  afterEach(async () => {
    await deleteS3KeysByPrefix(client, TEST_BUCKET, keyspacePrefix)
    await deleteS3KeysByPrefix(client, OTHER_BUCKET, keyspacePrefix)
  })

  afterAll(async () => {
    client.destroy()
  })

  describe("body format", () => {
    it("returns Readable stream body", async () => {
      const ref = { bucket: TEST_BUCKET, key: "s3/stream.txt" }
      await storage.put(ref, Buffer.from("stream test"))

      const obj = await storage.get(ref)
      expect(obj!.body).toHaveProperty("pipe")
    })
  })

  describe("etag", () => {
    it("returns etag on head", async () => {
      const ref = { bucket: TEST_BUCKET, key: "s3/etag.txt" }
      await storage.put(ref, Buffer.from("etag test"))

      const meta = await storage.head(ref)
      expect(meta!.etag).toBeDefined()
      expect(meta!.etag).toMatch(/^"?[a-f0-9]+"?$/)
    })
  })

  describe("batching", () => {
    it("deleteMany batches correctly (S3 limit: 1000)", async () => {
      const keys: string[] = []
      for (let i = 0; i < 1500; i++) {
        keys.push(`s3/batch-delete/${i}.txt`)
      }

      await Promise.all(
        keys.map((key) => storage.put({ bucket: TEST_BUCKET, key }, Buffer.from("x"))),
      )

      await storage.deleteMany(TEST_BUCKET, keys)

      const remaining = await storage.list(TEST_BUCKET, { prefix: "s3/batch-delete/" })
      expect(remaining.objects.length).toBe(0)
    }, 60000)
  })

  describe("keyspacePrefix", () => {
    it("stores objects under the prefixed key in S3 but returns unprefixed keys", async () => {
      const ref = { bucket: TEST_BUCKET, key: "s3/prefixing/a.txt" }
      await storage.put(ref, Buffer.from("prefixed"))

      const raw = await client.send(
        new ListObjectsV2Command({
          Bucket: TEST_BUCKET,
          Prefix: `${keyspacePrefix}${ref.key}`,
        }),
      )

      expect(raw.Contents?.some((o) => o.Key === `${keyspacePrefix}${ref.key}`)).toBe(
        true,
      )

      const listed = await storage.list(TEST_BUCKET, { prefix: "s3/prefixing/" })
      const keys = listed.objects.map((o) => o.key)

      expect(keys).toContain("s3/prefixing/a.txt")
      expect(keys).not.toContain(`${keyspacePrefix}s3/prefixing/a.txt`)
    })

    it("filters by prefix relative to keyspacePrefix", async () => {
      await storage.put({ bucket: TEST_BUCKET, key: "app/db-url" }, Buffer.from("x"))
      await storage.put({ bucket: TEST_BUCKET, key: "app/api-key" }, Buffer.from("y"))
      await storage.put({ bucket: TEST_BUCKET, key: "other/stuff" }, Buffer.from("z"))

      const result = await storage.list(TEST_BUCKET, { prefix: "app/" })
      const keys = result.objects.map((o) => o.key).sort()

      expect(keys).toEqual(["app/api-key", "app/db-url"])
    })
  })

  describe("metadata mapping fallbacks", () => {
    it("uses clock.now() and 0 size when head response omits fields", async () => {
      const fixedNow = new Date("2020-01-01T00:00:00.000Z")

      const mockClient = {
        send: vi.fn(async () => ({
          ContentLength: undefined,
          LastModified: undefined,
          ETag: undefined,
          ContentType: undefined,
          Metadata: undefined,
        })),
        destroy: vi.fn(),
      } as unknown as S3Client

      const mockStorage = new S3Storage(
        { client: mockClient, clock: { now: () => fixedNow } as any },
        { keyspacePrefix },
      )

      const meta = await mockStorage.head({ bucket: TEST_BUCKET, key: "k" })
      expect(meta).not.toBeNull()
      expect(meta!.sizeInBytes).toBe(0)
      expect(meta!.lastModified.toISOString()).toBe(fixedNow.toISOString())
    })

    it("filters out list contents without keys and strips keyspacePrefix", async () => {
      const fixedNow = new Date("2020-01-02T00:00:00.000Z")

      const mockClient = {
        send: vi.fn(async () => ({
          Contents: [
            { Key: undefined },
            { Key: "unrelated/no-prefix.txt" },
            {
              Key: `${keyspacePrefix}alpha`,
              Size: undefined,
              LastModified: undefined,
              ETag: "etag",
            },
            { Key: `${keyspacePrefix}beta`, Size: 2, LastModified: fixedNow },
          ],
        })),
        destroy: vi.fn(),
      } as unknown as S3Client

      const mockStorage = new S3Storage(
        { client: mockClient, clock: { now: () => fixedNow } as any },
        { keyspacePrefix },
      )

      const result = await mockStorage.list(TEST_BUCKET)
      const keys = result.objects.map((o) => o.key).sort()

      expect(keys).toEqual(["alpha", "beta"])
      const alpha = result.objects.find((o) => o.key === "alpha")!
      expect(alpha.sizeInBytes).toBe(0)
      expect(alpha.lastModified.toISOString()).toBe(fixedNow.toISOString())
      expect(alpha.etag).toBe("etag")
    })
  })

  describe("presigned URLs", () => {
    beforeEach(() => {
      vi.mocked(getSignedUrl).mockReset()
    })

    it("presigned URL includes signature", async () => {
      const ref = { bucket: TEST_BUCKET, key: "s3/presign.txt" }
      await storage.put(ref, Buffer.from("presign"))

      vi.mocked(getSignedUrl).mockResolvedValueOnce(
        "https://example.invalid/download?X-Amz-Signature=abc&X-Amz-Expires=3600",
      )

      const url = await storage.getPresignedDownloadUrl(ref, { expiresInSeconds: 3600 })
      expect(url.searchParams.has("X-Amz-Signature")).toBe(true)
    })

    it("presigned upload URL respects expiresInSeconds and contentType", async () => {
      const ref = { bucket: TEST_BUCKET, key: "s3/presign-upload.txt" }

      const mockedGetSignedUrl = vi.mocked(getSignedUrl)
      mockedGetSignedUrl.mockResolvedValue(
        "https://example.invalid/upload?X-Amz-Signature=abc&X-Amz-Expires=1234",
      )

      const url = await storage.getPresignedUploadUrl(ref, {
        expiresInSeconds: 1234,
        contentType: "text/plain",
      })

      expect(url.searchParams.has("X-Amz-Signature")).toBe(true)
      expect(url.searchParams.get("X-Amz-Expires")).toBe("1234")

      expect(mockedGetSignedUrl).toHaveBeenCalledTimes(1)
      const [, command, options] = mockedGetSignedUrl.mock.calls[0]!
      expect((options as { expiresIn?: number }).expiresIn).toBe(1234)
      expect((command as { input?: { ContentType?: string } }).input?.ContentType).toBe(
        "text/plain",
      )
    })
  })
})
