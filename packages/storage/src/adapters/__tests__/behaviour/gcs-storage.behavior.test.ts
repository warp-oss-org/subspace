import type { Storage as GcsStorageClient } from "@google-cloud/storage"
import { SystemClock } from "@subspace/clock"
import { createGcsTestClient } from "../../../tests/utils/create-gcs-test-client"
import { deleteGcsObjectsByPrefix } from "../../../tests/utils/delete-gcs-objects-by-prefix"
import { ensureGcsBucketExists } from "../../../tests/utils/ensure-gcs-bucket-exists"
import { GcsStorage } from "../../gcs-storage"

describe("GCSStorage (behavior)", () => {
  let client: GcsStorageClient
  let keyspacePrefix: string

  let storage: GcsStorage

  const TEST_BUCKET = "test-bucket"
  const OTHER_BUCKET = "other-bucket"

  beforeAll(async () => {
    const setup = createGcsTestClient()

    client = setup.client
    keyspacePrefix = setup.keyspacePrefix

    storage = new GcsStorage({ client, clock: new SystemClock() }, { keyspacePrefix })

    await ensureGcsBucketExists(client, TEST_BUCKET)
    await ensureGcsBucketExists(client, OTHER_BUCKET)
  })

  afterEach(async () => {
    await deleteGcsObjectsByPrefix(client, TEST_BUCKET, keyspacePrefix)
    await deleteGcsObjectsByPrefix(client, OTHER_BUCKET, keyspacePrefix)
  })

  describe("etag", () => {
    it("returns etag (generation-based)", async () => {
      const ref = { bucket: TEST_BUCKET, key: "gcs/generation.txt" }
      await storage.put(ref, Buffer.from("v1"))

      const meta = await storage.head(ref)
      expect(meta!.etag).toBeDefined()
    })
  })

  describe("metadata", () => {
    it("handles GCS-style metadata keys", async () => {
      const ref = { bucket: TEST_BUCKET, key: "gcs/custom-meta.txt" }
      await storage.put(ref, Buffer.from("meta"), {
        metadata: { customKey: "customValue" },
      })

      const meta = await storage.head(ref)
      expect(meta!.metadata?.customKey).toBe("customValue")
    })
  })

  describe("presigned URLs", () => {
    it("presigned URL contains signature", async () => {
      const ref = { bucket: TEST_BUCKET, key: "gcs/presign.txt" }
      await storage.put(ref, Buffer.from("presign"))

      const url = await storage.getPresignedDownloadUrl(ref, { expiresInSeconds: 3600 })
      expect(url.href).toMatch(/X-Goog-Signature/i)
    })
  })
})
