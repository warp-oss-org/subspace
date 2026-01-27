import type { Clock, Seconds } from "@subspace/clock"
import type { JobStore } from "../infra/job-store"
import type { UploadMetadataStoreRedis } from "../infra/upload-metadata-store.redis"
import type { UploadObjectStoreS3 } from "../infra/upload-object-store.s3"
import { JobId } from "../model/job.model"
import {
  type CompleteUploadResult,
  type CreateUploadInput,
  type CreateUploadResult,
  type StorageLocation,
  UploadId,
  type UploadRecord,
} from "../model/upload.model"

type UploadOrchestratorDeps = {
  clock: Clock
  metadataStore: UploadMetadataStoreRedis
  jobStore: JobStore
  objectStore: UploadObjectStoreS3
  stagingLocation: StorageLocation
  presignedUrlExpirySeconds: Seconds
}

export class UploadOrchestrator {
  constructor(private readonly deps: UploadOrchestratorDeps) {}

  async createUpload(
    input: Omit<CreateUploadInput, "id" | "staging">,
  ): Promise<CreateUploadResult> {
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

    return {
      kind: "created",
      uploadId: id,
      presigned,
    }
  }

  async getUpload(id: UploadId): Promise<UploadRecord | null> {
    return await this.deps.metadataStore.get(id)
  }

  async completeUpload(uploadId: UploadId): Promise<CompleteUploadResult> {
    const upload = await this.deps.metadataStore.get(uploadId)

    if (!upload) return { kind: "not_found" }

    if (upload.status === "finalized") return { kind: "finalized", uploadId }
    if (upload.status === "failed")
      return { kind: "failed", reason: upload.failureReason ?? "unknown" }
    if (upload.status === "queued" || upload.status === "processing") {
      return { kind: "already_queued", uploadId }
    }

    const now = this.deps.clock.now()
    const markResult = await this.deps.metadataStore.markQueued({ uploadId }, now)

    if (markResult.kind !== "written" && markResult.kind !== "already") {
      return { kind: "failed", reason: markResult.kind }
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
}
