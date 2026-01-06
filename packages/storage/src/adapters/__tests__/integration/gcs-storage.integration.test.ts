import type { Storage as GcsStorageClient } from "@google-cloud/storage"
import { SystemClock } from "@subspace/clock"
import { createGcsTestClient } from "../../../tests/utils/create-gcs-test-client"
import { deleteGcsObjectsByPrefix } from "../../../tests/utils/delete-gcs-objects-by-prefix"
import { ensureGcsBucketExists } from "../../../tests/utils/ensure-gcs-bucket-exists"
import { GcsStorage } from "../../gcs-storage"

describe("GcsStorage (integration)", () => {
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

  afterAll(async () => {
    await deleteGcsObjectsByPrefix(client, TEST_BUCKET, keyspacePrefix)
    await deleteGcsObjectsByPrefix(client, OTHER_BUCKET, keyspacePrefix)
  })

  describe("cross-bucket operations", () => {
    it("copy works across buckets", async () => {
      const src = { bucket: TEST_BUCKET, key: "gcs/cross-bucket-src.txt" }
      const dst = { bucket: OTHER_BUCKET, key: "gcs/cross-bucket-dst.txt" }
      await storage.put(src, Buffer.from("cross bucket"))

      await storage.copy(src, dst)

      expect(await storage.exists(dst)).toBe(true)
    })
  })

  describe("presigned URL functionality", () => {
    it("presigned upload URL accepts PUT", async () => {
      const ref = { bucket: TEST_BUCKET, key: "gcs/presign-upload-test.txt" }
      const url = await storage.getPresignedUploadUrl(ref)

      const res = await fetch(url, {
        method: "PUT",
        body: "uploaded via presigned",
      })

      expect(res.ok).toBe(true)
      expect(await storage.exists(ref)).toBe(true)
    })

    it("presigned download URL returns content", async () => {
      const ref = { bucket: TEST_BUCKET, key: "gcs/presign-download-test.txt" }
      await storage.put(ref, Buffer.from("download me"))

      const url = await storage.getPresignedDownloadUrl(ref)
      const res = await fetch(url)

      expect(res.ok).toBe(true)
      expect(await res.text()).toBe("download me")
    })
  })
})
