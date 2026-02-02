import { Readable } from "node:stream"
import type { Clock, Seconds } from "@subspace/clock"
import type { Logger } from "@subspace/logger"
import type {
  ImageProcessor,
  ImageVariant,
  ProcessedImage,
} from "../model/image.processing.model"
import { type FinalizeJob, JobId } from "../model/job.model"
import {
  type CompleteUploadResult,
  type CreateUploadInput,
  type CreateUploadResult,
  type FinalizeUploadResult,
  type LoadUploadForFinalizationResult,
  type PromotedVariant,
  type StorageLocation,
  UploadId,
  type UploadRecord,
} from "../model/upload.model"
import type { JobStore } from "./job-store"
import type { UploadMetadataStore } from "./upload-metadata-store"
import type { UploadObjectStore } from "./upload-object-store"

type UploadOrchestratorDeps = {
  clock: Clock
  logger: Logger
  metadataStore: UploadMetadataStore
  jobStore: JobStore
  objectStore: UploadObjectStore
  imageProcessor: ImageProcessor
  stagingLocation: StorageLocation
  presignedUrlExpirySeconds: Seconds
}

export class UploadOrchestrator {
  constructor(private readonly deps: UploadOrchestratorDeps) {}

  async createUpload(
    input: Omit<CreateUploadInput, "id" | "staging">,
  ): Promise<CreateUploadResult> {
    this.deps.logger.info("Initiating file upload request", { filename: input.filename })

    const id = UploadId.generate()
    const now = this.deps.clock.now()

    const presigned = await this.deps.objectStore.getPresignedUploadUrl({
      uploadId: id,
      filename: input.filename,
      expiresInSeconds: this.deps.presignedUrlExpirySeconds,
      ...(input.contentType !== undefined && { contentType: input.contentType }),
    })

    const createInput: CreateUploadInput = {
      id,
      staging: this.deps.stagingLocation,
      filename: input.filename,
      ...(input.contentType !== undefined && { contentType: input.contentType }),
      ...(input.expectedSizeBytes !== undefined && {
        expectedSizeBytes: input.expectedSizeBytes,
      }),
    }

    await this.deps.metadataStore.create(createInput, now)

    this.deps.logger.info("Upload created successfully", { uploadId: id })

    return {
      kind: "created",
      uploadId: id,
      presigned,
    }
  }

  async getUpload(id: UploadId): Promise<UploadRecord | null> {
    return this.deps.metadataStore.get(id)
  }

  async completeUpload(uploadId: UploadId): Promise<CompleteUploadResult> {
    const upload = await this.deps.metadataStore.get(uploadId)

    if (!upload) return { kind: "not_found" }

    if (upload.status === "finalized") {
      return { kind: "finalized", uploadId }
    }

    if (upload.status === "failed") {
      return {
        kind: "failed",
        reason: upload.failureReason ?? "unknown",
      }
    }

    if (upload.status === "queued" || upload.status === "processing") {
      return { kind: "already_queued", uploadId }
    }

    const now = this.deps.clock.now()
    const mark = await this.deps.metadataStore.markQueued({ uploadId }, now)

    if (mark.kind !== "written" && mark.kind !== "already") {
      return { kind: "failed", reason: mark.kind }
    }

    await this.deps.jobStore.enqueue({
      id: JobId.generate(),
      uploadId,
      status: "pending",
      attempt: 0,
      runAt: now,
      createdAt: now,
      updatedAt: now,
    })

    return { kind: "queued", uploadId }
  }

  async finalizeUpload(job: FinalizeJob): Promise<FinalizeUploadResult> {
    const loadResult = await this.loadUploadForFinalization(job)

    if (loadResult.kind !== "loaded") return loadResult

    const { upload, filename } = loadResult
    const now = this.deps.clock.now()

    const processingResult = await this.ensureProcessingState(upload, filename, now)
    if (processingResult !== true) {
      return processingResult
    }

    return this.promoteAndFinalize(upload, filename, now)
  }

  private async loadUploadForFinalization(
    job: FinalizeJob,
  ): Promise<LoadUploadForFinalizationResult> {
    const upload = await this.deps.metadataStore.get(job.uploadId)

    if (!upload) {
      return { kind: "not_found", uploadId: job.uploadId }
    }

    if (upload.status === "finalized") {
      return { kind: "already_finalized", uploadId: upload.id }
    }

    if (upload.status === "failed") {
      return {
        kind: "failed",
        uploadId: upload.id,
        reason: upload.failureReason ?? "unknown",
      }
    }

    if (!upload.filename) {
      return { kind: "failed", uploadId: upload.id, reason: "missing_filename" }
    }

    return { kind: "loaded", upload, filename: upload.filename }
  }

  private async ensureProcessingState(
    upload: UploadRecord,
    filename: string,
    now: Date,
  ): Promise<true | FinalizeUploadResult> {
    if (upload.status === "queued") {
      const result = await this.deps.metadataStore.markProcessing(
        { uploadId: upload.id, filename },
        now,
      )

      if (result.kind !== "written" && result.kind !== "already") {
        return { kind: "failed", uploadId: upload.id, reason: result.kind }
      }
    } else if (upload.status !== "processing") {
      return { kind: "failed", uploadId: upload.id, reason: "invalid_state" }
    }

    return true
  }

  private async promoteAndFinalize(
    upload: UploadRecord,
    filename: string,
    now: Date,
  ): Promise<FinalizeUploadResult> {
    const stagingObject = await this.deps.objectStore.getStagingObject({
      uploadId: upload.id,
      filename,
    })

    if (!stagingObject || !stagingObject.metadata) {
      return {
        kind: "retry",
        uploadId: upload.id,
        reason: "staging_object_missing",
      }
    }

    const contentType = upload.contentType ?? "application/octet-stream"
    const data = Buffer.isBuffer(stagingObject.body)
      ? Readable.from(stagingObject.body)
      : stagingObject.body

    const processed = await this.deps.imageProcessor.process({ data, contentType })
    const promotedVariants = await this.uploadVariants(upload.id, filename, processed)

    const originalVariant = promotedVariants.find((v) => v.variant === "original")
    if (!originalVariant) {
      return {
        kind: "failed",
        uploadId: upload.id,
        reason: "missing_original_variant",
      }
    }

    const finalized = await this.deps.metadataStore.markFinalized(
      {
        uploadId: upload.id,
        final: originalVariant.location,
        actualSizeBytes: stagingObject.sizeInBytes,
        variants: promotedVariants,
      },
      now,
    )

    if (finalized.kind !== "written" && finalized.kind !== "already") {
      return { kind: "failed", uploadId: upload.id, reason: finalized.kind }
    }

    return { kind: "finalized", uploadId: upload.id }
  }

  private async uploadVariants(
    uploadId: UploadId,
    filename: string,
    processed: ProcessedImage,
  ): Promise<PromotedVariant[]> {
    return Promise.all(
      processed.variants.map((variant) =>
        this.uploadVariant(uploadId, filename, variant),
      ),
    )
  }

  private async uploadVariant(
    uploadId: UploadId,
    filename: string,
    variant: ImageVariant,
  ): Promise<PromotedVariant> {
    const variantFilename = this.buildVariantFilename(filename, variant.variant)

    const ref = await this.deps.objectStore.putFinalObject({
      uploadId,
      filename: variantFilename,
      data: variant.data,
      contentType: variant.contentType,
    })

    return {
      variant: variant.variant,
      location: ref,
    }
  }

  private buildVariantFilename(filename: string, variant: string): string {
    if (variant === "original") return filename

    const lastDot = filename.lastIndexOf(".")
    if (lastDot === -1) {
      return `${filename}-${variant}`
    }

    return `${filename.slice(0, lastDot)}-${variant}${filename.slice(lastDot)}`
  }
}
