import type { S3Client } from "@aws-sdk/client-s3"
import { SystemClock } from "@subspace/clock"
import { createS3TestClient } from "../../../tests/utils/create-s3-test-client"
import { deleteS3KeysByPrefix } from "../../../tests/utils/delete-s3-keys-by-prefix"
import { ensureS3BucketExists } from "../../../tests/utils/ensure-s3-bucket-exists"
import { S3Storage } from "../../s3-storage"

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

  describe("presigned URLs", () => {
    it("presigned URL includes signature", async () => {
      const ref = { bucket: TEST_BUCKET, key: "s3/presign.txt" }
      await storage.put(ref, Buffer.from("presign"))

      const url = await storage.getPresignedDownloadUrl(ref, { expiresInSeconds: 3600 })
      expect(url.searchParams.has("X-Amz-Signature")).toBe(true)
    })
  })
})
