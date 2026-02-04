import { Readable } from "node:stream"
import { type Clock, FakeClock } from "@subspace/clock"
import { createMemoryStorage, type StoragePort } from "@subspace/storage"
import type { UploadId } from "../../model/upload.model"
import { UploadObjectStore, type UploadObjectStoreOptions } from "../upload-object-store"

describe("UploadObjectStore", () => {
  let store: UploadObjectStore

  let clock: Clock
  let objectStorage: StoragePort
  let opts: UploadObjectStoreOptions

  const uploadId = "upload_test-123" as UploadId
  const filename = "photo.jpg"

  beforeEach(() => {
    clock = new FakeClock()

    objectStorage = createMemoryStorage({ clock })

    opts = {
      bucket: "test-bucket",
      stagingPrefix: "staging",
      finalPrefix: "final",
    }
    store = new UploadObjectStore({ objectStorage, clock }, opts)
  })

  describe("getPresignedUploadUrl", () => {
    it("returns a presigned URL for uploading", async () => {
      const result = await store.getPresignedUploadUrl({
        uploadId,
        filename,
        expiresInSeconds: 3600,
      })

      expect(result.url).toContain(filename)
    })

    it("returns the staging object ref", async () => {
      const result = await store.getPresignedUploadUrl({
        uploadId,
        filename,
        expiresInSeconds: 3600,
      })

      expect(result.ref.bucket).toBe(opts.bucket)
      expect(result.ref.key).toContain(uploadId)
      expect(result.ref.key).toContain(filename)
    })

    it("uses the configured bucket", async () => {
      const result = await store.getPresignedUploadUrl({
        uploadId,
        filename,
        expiresInSeconds: 3600,
      })

      expect(result.ref.bucket).toBe(opts.bucket)
    })

    it("constructs key with staging prefix, uploadId, and filename", async () => {
      const result = await store.getPresignedUploadUrl({
        uploadId,
        filename,
        expiresInSeconds: 3600,
      })

      expect(result.ref.key).toBe(`${opts.stagingPrefix}/${uploadId}/${filename}`)
    })

    it("passes expiresInSeconds to storage", async () => {
      const spy = vi.spyOn(objectStorage, "getPresignedUploadUrl")

      await store.getPresignedUploadUrl({
        uploadId,
        filename,
        expiresInSeconds: 7200,
      })

      expect(spy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ expiresInSeconds: 7200 }),
      )
    })

    it("passes contentType when provided", async () => {
      const spy = vi.spyOn(objectStorage, "getPresignedUploadUrl")

      await store.getPresignedUploadUrl({
        uploadId,
        filename,
        expiresInSeconds: 3600,
        contentType: "image/jpeg",
      })

      expect(spy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ contentType: "image/jpeg" }),
      )
    })

    it("omits contentType when not provided", async () => {
      const spy = vi.spyOn(objectStorage, "getPresignedUploadUrl")

      await store.getPresignedUploadUrl({
        uploadId,
        filename,
        expiresInSeconds: 3600,
      })

      expect(spy).toHaveBeenCalledWith(
        expect.anything(),
        expect.not.objectContaining({ contentType: expect.anything() }),
      )
    })
  })

  describe("headStagingObject", () => {
    it("returns metadata and ref when object exists", async () => {
      const key = `${opts.stagingPrefix}/${uploadId}/${filename}`
      await objectStorage.put({ bucket: opts.bucket, key }, Buffer.from("test data"), {
        contentType: "image/jpeg",
      })

      const result = await store.headStagingObject({ uploadId, filename })

      expect(result).not.toBeNull()
      expect(result?.metadata.sizeInBytes).toBe(9)
      expect(result?.ref.key).toBe(key)
    })

    it("returns null when object does not exist", async () => {
      const result = await store.headStagingObject({ uploadId, filename })

      expect(result).toBeNull()
    })

    it("constructs key with staging prefix, uploadId, and filename", async () => {
      const spy = vi.spyOn(objectStorage, "head")

      await store.headStagingObject({ uploadId, filename })

      expect(spy).toHaveBeenCalledWith({
        bucket: opts.bucket,
        key: `${opts.stagingPrefix}/${uploadId}/${filename}`,
      })
    })
  })

  describe("getStagingObject", () => {
    it("returns object data when it exists", async () => {
      const key = `${opts.stagingPrefix}/${uploadId}/${filename}`
      const data = Buffer.from("test image data")
      await objectStorage.put({ bucket: opts.bucket, key }, data)

      const result = await store.getStagingObject({ uploadId, filename })

      expect(result).not.toBeNull()
      expect(result?.body).toBeDefined()
    })

    it("returns null when object does not exist", async () => {
      const result = await store.getStagingObject({ uploadId, filename })

      expect(result).toBeNull()
    })

    it("constructs key with staging prefix, uploadId, and filename", async () => {
      const spy = vi.spyOn(objectStorage, "get")

      await store.getStagingObject({ uploadId, filename })

      expect(spy).toHaveBeenCalledWith({
        bucket: opts.bucket,
        key: `${opts.stagingPrefix}/${uploadId}/${filename}`,
      })
    })
  })

  describe("promoteToFinal", () => {
    beforeEach(async () => {
      const key = `${opts.stagingPrefix}/${uploadId}/${filename}`
      await objectStorage.put({ bucket: opts.bucket, key }, Buffer.from("test data"))
    })

    it("copies object from staging to final location", async () => {
      await store.promoteToFinal({ uploadId, filename })

      const finalKey = `${opts.finalPrefix}/${uploadId}/${filename}`
      const result = await objectStorage.get({ bucket: opts.bucket, key: finalKey })
      expect(result).not.toBeNull()
    })

    it("deletes the staging object after copy", async () => {
      await store.promoteToFinal({ uploadId, filename })

      const stagingKey = `${opts.stagingPrefix}/${uploadId}/${filename}`
      const result = await objectStorage.get({ bucket: opts.bucket, key: stagingKey })
      expect(result).toBeNull()
    })

    it("returns both staging and final refs", async () => {
      const result = await store.promoteToFinal({ uploadId, filename })

      expect(result.staging.key).toContain(opts.stagingPrefix)
      expect(result.final.key).toContain(opts.finalPrefix)
    })

    it("preserves uploadId and filename in final key", async () => {
      const result = await store.promoteToFinal({ uploadId, filename })

      expect(result.final.key).toContain(uploadId)
      expect(result.final.key).toContain(filename)
    })

    describe("failure scenarios", () => {
      it("propagates copy errors", async () => {
        vi.spyOn(objectStorage, "copy").mockRejectedValueOnce(new Error("copy failed"))

        await expect(store.promoteToFinal({ uploadId, filename })).rejects.toThrow(
          "copy failed",
        )
      })

      it("does not delete staging if copy fails", async () => {
        vi.spyOn(objectStorage, "copy").mockRejectedValueOnce(new Error("copy failed"))

        await expect(store.promoteToFinal({ uploadId, filename })).rejects.toThrow()

        const stagingKey = `${opts.stagingPrefix}/${uploadId}/${filename}`
        const result = await objectStorage.get({ bucket: opts.bucket, key: stagingKey })
        expect(result).not.toBeNull()
      })

      it("succeeds even if delete fails after successful copy", async () => {
        vi.spyOn(objectStorage, "delete").mockRejectedValueOnce(
          new Error("delete failed"),
        )

        const result = await store.promoteToFinal({ uploadId, filename })

        expect(result.final.key).toContain(opts.finalPrefix)
      })

      it("staging object may remain after successful promotion (cleanup handled elsewhere)", async () => {
        vi.spyOn(objectStorage, "delete").mockRejectedValueOnce(
          new Error("delete failed"),
        )

        await store.promoteToFinal({ uploadId, filename })

        const stagingKey = `${opts.stagingPrefix}/${uploadId}/${filename}`
        const result = await objectStorage.get({ bucket: opts.bucket, key: stagingKey })

        expect(result).not.toBeNull()
      })
    })
  })

  describe("putFinalObject", () => {
    it("writes object directly to final location", async () => {
      const data = Buffer.from("test data")

      await store.putFinalObject({
        uploadId,
        filename,
        data: Readable.from(data),
        contentType: "image/jpeg",
      })

      const finalKey = `${opts.finalPrefix}/${uploadId}/${filename}`
      const result = await objectStorage.get({ bucket: opts.bucket, key: finalKey })
      expect(result).not.toBeNull()
    })

    it("returns the final object ref", async () => {
      const data = Buffer.from("test data")

      const result = await store.putFinalObject({
        uploadId,
        filename,
        data: Readable.from(data),
        contentType: "image/jpeg",
      })

      expect(result.bucket).toBe(opts.bucket)
      expect(result.key).toContain(opts.finalPrefix)
    })

    it("uses final prefix in key", async () => {
      const data = Buffer.from("test data")

      const result = await store.putFinalObject({
        uploadId,
        filename,
        data: Readable.from(data),
        contentType: "image/jpeg",
      })

      expect(result.key).toBe(`${opts.finalPrefix}/${uploadId}/${filename}`)
    })

    it("passes contentType to storage", async () => {
      const spy = vi.spyOn(objectStorage, "put")
      const data = Buffer.from("test data")

      await store.putFinalObject({
        uploadId,
        filename,
        data: Readable.from(data),
        contentType: "image/png",
      })

      expect(spy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ contentType: "image/png" }),
      )
    })
  })

  describe("key structure", () => {
    it("staging key follows pattern: {stagingPrefix}/{uploadId}/{filename}", async () => {
      const result = await store.getPresignedUploadUrl({
        uploadId,
        filename,
        expiresInSeconds: 3600,
      })

      expect(result.ref.key).toBe("staging/upload_test-123/photo.jpg")
    })

    it("final key follows pattern: {finalPrefix}/{uploadId}/{filename}", async () => {
      const stagingKey = `${opts.stagingPrefix}/${uploadId}/${filename}`
      await objectStorage.put(
        { bucket: opts.bucket, key: stagingKey },
        Buffer.from("data"),
      )

      const result = await store.promoteToFinal({ uploadId, filename })

      expect(result.final.key).toBe("final/upload_test-123/photo.jpg")
    })

    it("handles filenames with special characters", async () => {
      const specialFilename = "photo (1).jpg"

      const result = await store.getPresignedUploadUrl({
        uploadId,
        filename: specialFilename,
        expiresInSeconds: 3600,
      })

      expect(result.ref.key).toBe(`staging/${uploadId}/${specialFilename}`)
    })

    it("handles filenames with path separators", async () => {
      const pathFilename = "folder/subfolder/photo.jpg"

      const result = await store.getPresignedUploadUrl({
        uploadId,
        filename: pathFilename,
        expiresInSeconds: 3600,
      })

      expect(result.ref.key).toBe(`staging/${uploadId}/${pathFilename}`)
    })
  })
})
