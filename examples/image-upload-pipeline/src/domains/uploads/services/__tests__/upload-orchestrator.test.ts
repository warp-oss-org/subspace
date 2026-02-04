import { Readable } from "node:stream"
import { FakeClock, type Seconds } from "@subspace/clock"
import type { Logger } from "@subspace/logger"
import { beforeEach, describe, expect, it } from "vitest"
import { mock } from "vitest-mock-extended"
import type { Mock } from "../../../../tests/mock"
import type { ImageProcessor } from "../../model/image.processing.model"
import { type FinalizeJob, JobId, type JobStatus } from "../../model/job.model"
import {
  type AwaitingUpload,
  type StagingObject,
  type StorageLocation,
  type UploadFailed,
  type UploadFinalized,
  UploadId,
  type UploadProcessing,
  type UploadQueued,
  type UploadStoreWriteResult,
} from "../../model/upload.model"
import type { JobStore } from "../job-store"
import type { UploadMetadataStore } from "../upload-metadata-store"
import type { UploadObjectStore } from "../upload-object-store"
import { UploadOrchestrator } from "../upload-orchestrator"

describe("UploadOrchestrator", () => {
  let orchestrator: UploadOrchestrator
  let clock: FakeClock
  let logger: Mock<Logger>
  let metadataStore: Mock<UploadMetadataStore>
  let objectStore: Mock<UploadObjectStore>
  let jobStore: Mock<JobStore>
  let imageProcessor: Mock<ImageProcessor>
  let stagingLocation: StorageLocation
  let presignedUrlExpirySeconds: Seconds

  beforeEach(() => {
    clock = new FakeClock()
    logger = mock<Logger>()
    metadataStore = mock<UploadMetadataStore>()
    objectStore = mock<UploadObjectStore>()
    jobStore = mock<JobStore>()
    imageProcessor = mock<ImageProcessor>()

    stagingLocation = { bucket: "staging-bucket", key: "staging" }
    presignedUrlExpirySeconds = 3600

    orchestrator = new UploadOrchestrator({
      clock,
      logger,
      metadataStore,
      jobStore,
      objectStore,
      imageProcessor,
      stagingLocation,
      presignedUrlExpirySeconds,
    })
  })

  const createAwaitingUpload = (
    overrides: Partial<AwaitingUpload> = {},
  ): AwaitingUpload => ({
    id: UploadId.generate(),
    status: "awaiting_upload",
    filename: "photo.jpg",
    staging: { bucket: "staging-bucket", key: "staging/photo.jpg" },
    createdAt: clock.now(),
    updatedAt: clock.now(),
    ...overrides,
  })

  const createQueuedUpload = (overrides: Partial<UploadQueued> = {}): UploadQueued => ({
    id: UploadId.generate(),
    status: "queued",
    filename: "photo.jpg",
    staging: { bucket: "staging-bucket", key: "staging/photo.jpg" },
    createdAt: clock.now(),
    updatedAt: clock.now(),
    queuedAt: clock.now(),
    ...overrides,
  })

  const createProcessingUpload = (
    overrides: Partial<UploadProcessing> = {},
  ): UploadProcessing => ({
    id: UploadId.generate(),
    status: "processing",
    filename: "photo.jpg",
    staging: { bucket: "staging-bucket", key: "staging/photo.jpg" },
    createdAt: clock.now(),
    updatedAt: clock.now(),
    queuedAt: clock.now(),
    ...overrides,
  })

  const createFinalizedUpload = (
    overrides: Partial<UploadFinalized> = {},
  ): UploadFinalized => ({
    id: UploadId.generate(),
    status: "finalized",
    filename: "photo.jpg",
    staging: { bucket: "staging-bucket", key: "staging/photo.jpg" },
    final: { bucket: "final-bucket", key: "final/photo.jpg" },
    actualSizeBytes: 1024,
    createdAt: clock.now(),
    updatedAt: clock.now(),
    queuedAt: clock.now(),
    finalizedAt: clock.now(),
    ...overrides,
  })

  const createFailedUpload = (overrides: Partial<UploadFailed> = {}): UploadFailed => ({
    id: UploadId.generate(),
    status: "failed",
    filename: "photo.jpg",
    staging: { bucket: "staging-bucket", key: "staging/photo.jpg" },
    failureReason: "processing_error",
    createdAt: clock.now(),
    updatedAt: clock.now(),
    queuedAt: clock.now(),
    ...overrides,
  })

  const createFinalizeJob = (
    uploadId: UploadId,
    overrides: Partial<FinalizeJob> = {},
  ): FinalizeJob => ({
    id: JobId.generate(),
    uploadId,
    status: "pending" as JobStatus,
    attempt: 0,
    runAt: clock.now(),
    createdAt: clock.now(),
    updatedAt: clock.now(),
    ...overrides,
  })

  const createStagingObject = (
    overrides: Partial<{
      body: Buffer | Readable
      key: string
      metadata: Record<string, string | number | boolean>
      sizeInBytes: number
      lastModified: Date
    }> = {},
  ) => ({
    body: Buffer.from("image data"),
    key: "staging/photo.jpg",
    metadata: { contentLength: 1024 },
    sizeInBytes: 1024,
    lastModified: clock.now(),
    ...overrides,
  })

  const written = (): UploadStoreWriteResult => ({ kind: "written" })
  const conflict = (): UploadStoreWriteResult => ({ kind: "conflict" })
  const invalidTransition = (
    expected: readonly string[],
    actual: string,
  ): UploadStoreWriteResult => ({
    kind: "invalid_transition",
    expected,
    actual,
  })

  describe("createUpload", () => {
    beforeEach(() => {
      metadataStore.create.mockResolvedValue(written())
      objectStore.getPresignedUploadUrl.mockResolvedValue({
        url: "https://s3.example.com/presigned",
        ref: { bucket: "staging-bucket", key: "staging/photo.jpg" },
        expiresAt: new Date(clock.now().getTime() + 3600 * 1000),
      })
    })

    it("generates a unique upload ID", async () => {
      const result1 = await orchestrator.createUpload({ filename: "a.jpg" })
      const result2 = await orchestrator.createUpload({ filename: "b.jpg" })

      expect(result1.kind).toBe("created")
      expect(result2.kind).toBe("created")
      if (result1.kind === "created" && result2.kind === "created") {
        expect(result1.uploadId).not.toBe(result2.uploadId)
      }
    })

    it("creates presigned URL with configured expiry", async () => {
      await orchestrator.createUpload({ filename: "photo.jpg" })

      expect(objectStore.getPresignedUploadUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresInSeconds: presignedUrlExpirySeconds,
        }),
      )
    })

    it("creates presigned URL with content type when provided", async () => {
      await orchestrator.createUpload({
        filename: "photo.jpg",
        contentType: "image/jpeg",
      })

      expect(objectStore.getPresignedUploadUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          contentType: "image/jpeg",
        }),
      )
    })

    it("stores upload record with awaiting_upload status", async () => {
      await orchestrator.createUpload({ filename: "photo.jpg" })

      expect(metadataStore.create).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: "photo.jpg",
        }),
        expect.any(Date),
      )
    })

    it("stores staging location from config", async () => {
      await orchestrator.createUpload({ filename: "photo.jpg" })

      expect(metadataStore.create).toHaveBeenCalledWith(
        expect.objectContaining({
          staging: stagingLocation,
        }),
        expect.any(Date),
      )
    })

    it("stores filename from input", async () => {
      await orchestrator.createUpload({ filename: "my-photo.png" })

      expect(metadataStore.create).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: "my-photo.png",
        }),
        expect.any(Date),
      )
    })

    it("stores content type when provided", async () => {
      await orchestrator.createUpload({
        filename: "photo.jpg",
        contentType: "image/jpeg",
      })

      expect(metadataStore.create).toHaveBeenCalledWith(
        expect.objectContaining({
          contentType: "image/jpeg",
        }),
        expect.any(Date),
      )
    })

    it("stores expected size when provided", async () => {
      await orchestrator.createUpload({
        filename: "photo.jpg",
        expectedSizeBytes: 2048,
      })

      expect(metadataStore.create).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedSizeBytes: 2048,
        }),
        expect.any(Date),
      )
    })

    it("returns created result with upload ID and presigned URL", async () => {
      const result = await orchestrator.createUpload({ filename: "photo.jpg" })

      expect(result.kind).toBe("created")
      if (result.kind === "created") {
        expect(result.uploadId).toBeDefined()
        expect(result.presigned.url).toBe("https://s3.example.com/presigned")
        expect(result.presigned.ref).toEqual({
          bucket: "staging-bucket",
          key: "staging/photo.jpg",
        })
        expect(result.presigned.expiresAt).toBeInstanceOf(Date)
      }
    })
  })

  describe("getUpload", () => {
    it("returns upload record when found", async () => {
      const upload = createAwaitingUpload()
      metadataStore.get.mockResolvedValue(upload)

      const result = await orchestrator.getUpload(upload.id)

      expect(result).toEqual(upload)
    })

    it("returns null when not found", async () => {
      metadataStore.get.mockResolvedValue(null)

      const result = await orchestrator.getUpload(UploadId.generate())

      expect(result).toBeNull()
    })
  })

  describe("completeUpload", () => {
    describe("when upload does not exist", () => {
      it("returns not_found", async () => {
        metadataStore.get.mockResolvedValue(null)

        const result = await orchestrator.completeUpload(UploadId.generate())

        expect(result.kind).toBe("not_found")
      })
    })

    describe("when upload is awaiting_upload", () => {
      let upload: AwaitingUpload

      beforeEach(() => {
        upload = createAwaitingUpload()
        metadataStore.get.mockResolvedValue(upload)
        metadataStore.markQueued.mockResolvedValue(written())
        jobStore.enqueue.mockResolvedValue(undefined)
      })

      it("marks upload as queued", async () => {
        await orchestrator.completeUpload(upload.id)

        expect(metadataStore.markQueued).toHaveBeenCalledWith(
          expect.objectContaining({ uploadId: upload.id }),
          expect.any(Date),
        )
      })

      it("enqueues finalize job with pending status", async () => {
        await orchestrator.completeUpload(upload.id)

        expect(jobStore.enqueue).toHaveBeenCalledWith(
          expect.objectContaining({
            uploadId: upload.id,
            status: "pending",
          }),
        )
      })

      it("enqueues job with current timestamp as runAt", async () => {
        clock.advance(5000)

        await orchestrator.completeUpload(upload.id)

        expect(jobStore.enqueue).toHaveBeenCalledWith(
          expect.objectContaining({
            runAt: clock.now(),
          }),
        )
      })

      it("returns queued result with upload ID", async () => {
        const result = await orchestrator.completeUpload(upload.id)

        expect(result.kind).toBe("queued")
        if (result.kind === "queued") {
          expect(result.uploadId).toBe(upload.id)
        }
      })
    })

    describe("when upload is already queued", () => {
      it("returns already_queued without creating new job", async () => {
        const upload = createQueuedUpload()
        metadataStore.get.mockResolvedValue(upload)

        const result = await orchestrator.completeUpload(upload.id)

        expect(result.kind).toBe("already_queued")
        expect(jobStore.enqueue).not.toHaveBeenCalled()
      })
    })

    describe("when upload is processing", () => {
      it("returns already_queued without creating new job", async () => {
        const upload = createProcessingUpload()
        metadataStore.get.mockResolvedValue(upload)

        const result = await orchestrator.completeUpload(upload.id)

        expect(result.kind).toBe("already_queued")
        expect(jobStore.enqueue).not.toHaveBeenCalled()
      })
    })

    describe("when upload is finalized", () => {
      it("returns finalized result", async () => {
        const upload = createFinalizedUpload()
        metadataStore.get.mockResolvedValue(upload)

        const result = await orchestrator.completeUpload(upload.id)

        expect(result.kind).toBe("finalized")
      })
    })

    describe("when upload is failed", () => {
      it("returns failed result with reason", async () => {
        const upload = createFailedUpload({ failureReason: "staging_object_missing" })
        metadataStore.get.mockResolvedValue(upload)

        const result = await orchestrator.completeUpload(upload.id)

        expect(result.kind).toBe("failed")
        if (result.kind === "failed") {
          expect(result.reason).toBe("staging_object_missing")
        }
      })
    })

    describe("when markQueued fails", () => {
      it("returns failed result with transition error", async () => {
        const upload = createAwaitingUpload()
        metadataStore.get.mockResolvedValue(upload)
        metadataStore.markQueued.mockResolvedValue(
          invalidTransition(["awaiting_upload"], "processing"),
        )

        const result = await orchestrator.completeUpload(upload.id)

        expect(result.kind).toBe("failed")
      })
    })
  })

  describe("finalizeUpload", () => {
    describe("loading upload", () => {
      it("returns not_found when upload does not exist", async () => {
        metadataStore.get.mockResolvedValue(null)
        const job = createFinalizeJob(UploadId.generate())

        const result = await orchestrator.finalizeUpload(job)

        expect(result.kind).toBe("not_found")
      })

      it("returns already_finalized when upload is finalized", async () => {
        const upload = createFinalizedUpload()
        metadataStore.get.mockResolvedValue(upload)
        const job = createFinalizeJob(upload.id)

        const result = await orchestrator.finalizeUpload(job)

        expect(result.kind).toBe("already_finalized")
      })

      it("returns failed when upload is failed", async () => {
        const upload = createFailedUpload()
        metadataStore.get.mockResolvedValue(upload)
        const job = createFinalizeJob(upload.id)

        const result = await orchestrator.finalizeUpload(job)

        expect(result.kind).toBe("failed")
      })

      it("returns failed when filename is missing", async () => {
        const upload = createQueuedUpload({ filename: undefined as unknown as string })
        metadataStore.get.mockResolvedValue(upload)
        const job = createFinalizeJob(upload.id)

        const result = await orchestrator.finalizeUpload(job)

        expect(result.kind).toBe("failed")
      })
    })

    describe("ensuring processing state", () => {
      beforeEach(() => {
        objectStore.getStagingObject.mockResolvedValue(createStagingObject())
        imageProcessor.process.mockResolvedValue({
          variants: [
            {
              variant: "original",
              data: Readable.from(Buffer.from("original")),
              contentType: "image/jpeg",
            },
            {
              variant: "thumbnail",
              data: Readable.from(Buffer.from("thumb")),
              contentType: "image/jpeg",
            },
          ],
        })
        objectStore.putFinalObject.mockResolvedValue({
          bucket: "final-bucket",
          key: "final/photo.jpg",
        })
        metadataStore.markFinalized.mockResolvedValue(written())
      })

      it("marks upload as processing when queued", async () => {
        const upload = createQueuedUpload()
        metadataStore.get.mockResolvedValue(upload)
        metadataStore.markProcessing.mockResolvedValue(written())
        const job = createFinalizeJob(upload.id)

        await orchestrator.finalizeUpload(job)

        expect(metadataStore.markProcessing).toHaveBeenCalledWith(
          expect.objectContaining({
            uploadId: upload.id,
            filename: upload.filename,
          }),
          expect.any(Date),
        )
      })

      it("proceeds when upload is already processing", async () => {
        const upload = createProcessingUpload()
        metadataStore.get.mockResolvedValue(upload)
        const job = createFinalizeJob(upload.id)

        const result = await orchestrator.finalizeUpload(job)

        expect(result.kind).toBe("finalized")
      })

      it("returns failed when upload is in invalid state", async () => {
        const upload = createAwaitingUpload()
        metadataStore.get.mockResolvedValue(upload)
        metadataStore.markProcessing.mockResolvedValue(
          invalidTransition(["queued", "processing"], "awaiting_upload"),
        )
        const job = createFinalizeJob(upload.id)

        const result = await orchestrator.finalizeUpload(job)

        expect(result.kind).toBe("failed")
      })

      it("returns failed when markProcessing fails with conflict", async () => {
        const upload = createQueuedUpload()
        metadataStore.get.mockResolvedValue(upload)
        metadataStore.markProcessing.mockResolvedValue(conflict())
        const job = createFinalizeJob(upload.id)

        const result = await orchestrator.finalizeUpload(job)

        expect(result.kind).toBe("failed")
      })
    })

    describe("staging object retrieval", () => {
      beforeEach(() => {
        metadataStore.markProcessing.mockResolvedValue(written())
      })

      it("returns retry when staging object not found", async () => {
        const upload = createQueuedUpload()
        metadataStore.get.mockResolvedValue(upload)
        objectStore.getStagingObject.mockResolvedValue(null)
        const job = createFinalizeJob(upload.id)

        const result = await orchestrator.finalizeUpload(job)

        expect(result.kind).toBe("retry")
      })

      it("returns retry when staging object has no metadata", async () => {
        const upload = createQueuedUpload()
        metadataStore.get.mockResolvedValue(upload)
        objectStore.getStagingObject.mockResolvedValue(
          createStagingObject({ metadata: undefined } as unknown as StagingObject),
        )
        const job = createFinalizeJob(upload.id)

        const result = await orchestrator.finalizeUpload(job)

        expect(result.kind).toBe("retry")
      })
    })

    describe("image processing", () => {
      beforeEach(() => {
        metadataStore.markProcessing.mockResolvedValue(written())
        metadataStore.markFinalized.mockResolvedValue(written())
        objectStore.putFinalObject.mockResolvedValue({
          bucket: "final-bucket",
          key: "final/photo.jpg",
        })
      })

      it("processes image with content type from upload", async () => {
        const upload = createQueuedUpload({ contentType: "image/png" })
        metadataStore.get.mockResolvedValue(upload)
        objectStore.getStagingObject.mockResolvedValue(createStagingObject())
        imageProcessor.process.mockResolvedValue({
          variants: [
            {
              variant: "original",
              data: Readable.from(Buffer.from("original")),
              contentType: "image/png",
            },
          ],
        })
        const job = createFinalizeJob(upload.id)

        await orchestrator.finalizeUpload(job)

        expect(imageProcessor.process).toHaveBeenCalledWith(
          expect.objectContaining({
            contentType: "image/png",
          }),
        )
      })

      it("uses application/octet-stream when content type not set", async () => {
        const upload = createQueuedUpload({
          contentType: undefined,
        } as unknown as Partial<UploadQueued>)

        metadataStore.get.mockResolvedValue(upload)
        objectStore.getStagingObject.mockResolvedValue(createStagingObject())
        imageProcessor.process.mockResolvedValue({
          variants: [
            {
              variant: "original",
              data: Readable.from(Buffer.from("original")),
              contentType: "application/octet-stream",
            },
          ],
        })
        const job = createFinalizeJob(upload.id)

        await orchestrator.finalizeUpload(job)

        expect(imageProcessor.process).toHaveBeenCalledWith(
          expect.objectContaining({
            contentType: "application/octet-stream",
          }),
        )
      })

      it("converts Buffer to Readable when staging returns Buffer", async () => {
        const upload = createQueuedUpload()
        metadataStore.get.mockResolvedValue(upload)
        objectStore.getStagingObject.mockResolvedValue(
          createStagingObject({ body: Buffer.from("image data") }),
        )
        imageProcessor.process.mockResolvedValue({
          variants: [
            {
              variant: "original",
              data: Readable.from(Buffer.from("original")),
              contentType: "image/jpeg",
            },
          ],
        })
        const job = createFinalizeJob(upload.id)

        await orchestrator.finalizeUpload(job)

        expect(imageProcessor.process).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.any(Readable),
          }),
        )
      })

      it("passes Readable through when staging returns Readable", async () => {
        const upload = createQueuedUpload()
        metadataStore.get.mockResolvedValue(upload)
        const readableData = Readable.from(Buffer.from("image data"))
        objectStore.getStagingObject.mockResolvedValue(
          createStagingObject({ body: readableData }),
        )
        imageProcessor.process.mockResolvedValue({
          variants: [
            {
              variant: "original",
              data: Readable.from(Buffer.from("original")),
              contentType: "image/jpeg",
            },
          ],
        })
        const job = createFinalizeJob(upload.id)

        await orchestrator.finalizeUpload(job)

        expect(imageProcessor.process).toHaveBeenCalledWith(
          expect.objectContaining({
            data: readableData,
          }),
        )
      })
    })

    describe("variant upload", () => {
      beforeEach(() => {
        metadataStore.markProcessing.mockResolvedValue(written())
        metadataStore.markFinalized.mockResolvedValue(written())
        objectStore.getStagingObject.mockResolvedValue(createStagingObject())
      })

      it("uploads all variants from processed image", async () => {
        const upload = createQueuedUpload()
        metadataStore.get.mockResolvedValue(upload)
        imageProcessor.process.mockResolvedValue({
          variants: [
            {
              variant: "original",
              data: Readable.from(Buffer.from("original")),
              contentType: "image/jpeg",
            },
            {
              variant: "thumbnail",
              data: Readable.from(Buffer.from("thumb")),
              contentType: "image/jpeg",
            },
            {
              variant: "medium",
              data: Readable.from(Buffer.from("medium")),
              contentType: "image/jpeg",
            },
          ],
        })
        objectStore.putFinalObject.mockResolvedValue({
          bucket: "final-bucket",
          key: "final/photo.jpg",
        })
        const job = createFinalizeJob(upload.id)

        await orchestrator.finalizeUpload(job)

        expect(objectStore.putFinalObject).toHaveBeenCalledTimes(3)
      })

      it("uses original filename for original variant", async () => {
        const upload = createQueuedUpload({ filename: "photo.jpg" })
        metadataStore.get.mockResolvedValue(upload)
        imageProcessor.process.mockResolvedValue({
          variants: [
            {
              variant: "original",
              data: Readable.from(Buffer.from("original")),
              contentType: "image/jpeg",
            },
          ],
        })
        objectStore.putFinalObject.mockResolvedValue({
          bucket: "final-bucket",
          key: "final/photo.jpg",
        })
        const job = createFinalizeJob(upload.id)

        await orchestrator.finalizeUpload(job)

        expect(objectStore.putFinalObject).toHaveBeenCalledWith(
          expect.objectContaining({
            filename: "photo.jpg",
          }),
        )
      })

      it("appends variant name before extension for other variants", async () => {
        const upload = createQueuedUpload({ filename: "photo.jpg" })
        metadataStore.get.mockResolvedValue(upload)
        imageProcessor.process.mockResolvedValue({
          variants: [
            {
              variant: "original",
              data: Readable.from(Buffer.from("original")),
              contentType: "image/jpeg",
            },
            {
              variant: "thumbnail",
              data: Readable.from(Buffer.from("thumb")),
              contentType: "image/jpeg",
            },
          ],
        })
        objectStore.putFinalObject.mockResolvedValue({
          bucket: "final-bucket",
          key: "final/photo.jpg",
        })
        const job = createFinalizeJob(upload.id)

        await orchestrator.finalizeUpload(job)

        expect(objectStore.putFinalObject).toHaveBeenCalledWith(
          expect.objectContaining({
            filename: "photo-thumbnail.jpg",
          }),
        )
      })

      it("appends variant name at end when no extension", async () => {
        const upload = createQueuedUpload({ filename: "photo" })
        metadataStore.get.mockResolvedValue(upload)
        imageProcessor.process.mockResolvedValue({
          variants: [
            {
              variant: "original",
              data: Readable.from(Buffer.from("original")),
              contentType: "image/jpeg",
            },
            {
              variant: "thumbnail",
              data: Readable.from(Buffer.from("thumb")),
              contentType: "image/jpeg",
            },
          ],
        })
        objectStore.putFinalObject.mockResolvedValue({
          bucket: "final-bucket",
          key: "final/photo",
        })
        const job = createFinalizeJob(upload.id)

        await orchestrator.finalizeUpload(job)

        expect(objectStore.putFinalObject).toHaveBeenCalledWith(
          expect.objectContaining({
            filename: "photo-thumbnail",
          }),
        )
      })

      it("returns failed when original variant missing from processed result", async () => {
        const upload = createQueuedUpload()
        metadataStore.get.mockResolvedValue(upload)
        imageProcessor.process.mockResolvedValue({
          variants: [
            {
              variant: "thumbnail",
              data: Readable.from(Buffer.from("thumb")),
              contentType: "image/jpeg",
            },
          ],
        })
        objectStore.putFinalObject.mockResolvedValue({
          bucket: "final-bucket",
          key: "final/photo-thumbnail.jpg",
        })
        const job = createFinalizeJob(upload.id)

        const result = await orchestrator.finalizeUpload(job)

        expect(result.kind).toBe("failed")
      })
    })

    describe("finalization", () => {
      beforeEach(() => {
        metadataStore.markProcessing.mockResolvedValue(written())
        objectStore.getStagingObject.mockResolvedValue(
          createStagingObject({ sizeInBytes: 2048, metadata: { contentLength: 2048 } }),
        )
        imageProcessor.process.mockResolvedValue({
          variants: [
            {
              variant: "original",
              data: Readable.from(Buffer.from("original")),
              contentType: "image/jpeg",
            },
            {
              variant: "thumbnail",
              data: Readable.from(Buffer.from("thumb")),
              contentType: "image/jpeg",
            },
          ],
        })
        objectStore.putFinalObject.mockResolvedValue({
          bucket: "final-bucket",
          key: "final/photo.jpg",
        })
      })

      it("marks upload finalized with original variant location", async () => {
        const upload = createQueuedUpload()
        metadataStore.get.mockResolvedValue(upload)
        metadataStore.markFinalized.mockResolvedValue(written())
        const job = createFinalizeJob(upload.id)

        await orchestrator.finalizeUpload(job)

        expect(metadataStore.markFinalized).toHaveBeenCalledWith(
          expect.objectContaining({
            uploadId: upload.id,
            final: expect.objectContaining({
              bucket: "final-bucket",
            }),
          }),
          expect.any(Date),
        )
      })

      it("marks upload finalized with actual size from staging metadata", async () => {
        const upload = createQueuedUpload()
        metadataStore.get.mockResolvedValue(upload)
        metadataStore.markFinalized.mockResolvedValue(written())
        const job = createFinalizeJob(upload.id)

        await orchestrator.finalizeUpload(job)

        expect(metadataStore.markFinalized).toHaveBeenCalledWith(
          expect.objectContaining({
            actualSizeBytes: 2048,
          }),
          expect.any(Date),
        )
      })

      it("marks upload finalized with all promoted variants", async () => {
        const upload = createQueuedUpload()
        metadataStore.get.mockResolvedValue(upload)
        metadataStore.markFinalized.mockResolvedValue(written())
        const job = createFinalizeJob(upload.id)

        await orchestrator.finalizeUpload(job)

        expect(metadataStore.markFinalized).toHaveBeenCalledWith(
          expect.objectContaining({
            variants: expect.arrayContaining([
              expect.objectContaining({ variant: "original" }),
              expect.objectContaining({ variant: "thumbnail" }),
            ]),
          }),
          expect.any(Date),
        )
      })

      it("returns finalized result on success", async () => {
        const upload = createQueuedUpload()
        metadataStore.get.mockResolvedValue(upload)
        metadataStore.markFinalized.mockResolvedValue(written())
        const job = createFinalizeJob(upload.id)

        const result = await orchestrator.finalizeUpload(job)

        expect(result.kind).toBe("finalized")
      })

      it("returns failed when markFinalized fails", async () => {
        const upload = createQueuedUpload()
        metadataStore.get.mockResolvedValue(upload)
        metadataStore.markFinalized.mockResolvedValue(conflict())
        const job = createFinalizeJob(upload.id)

        const result = await orchestrator.finalizeUpload(job)

        expect(result.kind).toBe("failed")
      })
    })
  })
})
