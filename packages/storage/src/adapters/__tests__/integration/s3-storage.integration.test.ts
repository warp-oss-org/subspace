import type { S3Client } from "@aws-sdk/client-s3"
import { SystemClock } from "@subspace/clock"
import { createS3TestClient } from "../../../tests/utils/create-s3-test-client"
import { deleteS3KeysByPrefix } from "../../../tests/utils/delete-s3-keys-by-prefix"
import { ensureS3BucketExists } from "../../../tests/utils/ensure-s3-bucket-exists"
import { S3Storage } from "../../s3-storage"

describe("S3Storage (integration)", () => {
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

  afterAll(async () => {
    await deleteS3KeysByPrefix(client, TEST_BUCKET, keyspacePrefix)
    await deleteS3KeysByPrefix(client, OTHER_BUCKET, keyspacePrefix)
  })

  afterAll(async () => {
    client.destroy()
  })

  describe("cross-bucket operations", () => {
    it("copy works across buckets", async () => {
      const src = { bucket: TEST_BUCKET, key: "s3/cross-bucket-src.txt" }
      const dst = { bucket: OTHER_BUCKET, key: "s3/cross-bucket-dst.txt" }
      await storage.put(src, Buffer.from("cross bucket"))

      await storage.copy(src, dst)

      expect(await storage.exists(dst)).toBe(true)
    })
  })

  describe("presigned URL functionality", () => {
    it("presigned upload URL accepts PUT", async () => {
      const ref = { bucket: TEST_BUCKET, key: "s3/presign-upload-test.txt" }
      const url = await storage.getPresignedUploadUrl(ref)

      const res = await fetch(url, {
        method: "PUT",
        body: "uploaded via presigned",
      })

      expect(res.ok).toBe(true)
      expect(await storage.exists(ref)).toBe(true)
    })

    it("presigned download URL returns content", async () => {
      const ref = { bucket: TEST_BUCKET, key: "s3/presign-download-test.txt" }
      await storage.put(ref, Buffer.from("download me"))

      const url = await storage.getPresignedDownloadUrl(ref)
      const res = await fetch(url)

      expect(res.ok).toBe(true)
      expect(await res.text()).toBe("download me")
    })
  })
})
