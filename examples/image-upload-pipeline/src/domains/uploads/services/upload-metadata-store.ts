import type { KeyValueStoreCasAndConditional } from "@subspace/kv"
import type {
  AwaitingUpload,
  CreateUploadInput,
  MarkFailedInput,
  MarkFinalizedInput,
  MarkProcessingInput,
  MarkQueuedInput,
  UploadId,
  UploadStoreAlready as UploadMetadataStoreAlready,
  UploadStoreWriteResult as UploadMetadataStoreWriteResult,
  UploadStoreWritten as UploadMetadataStoreWritten,
  UploadQueued,
  UploadRecord,
  UploadStoreWriteResult,
} from "../model/upload.model"

const WRITTEN: UploadMetadataStoreWritten = { kind: "written" }
const ALREADY: UploadMetadataStoreAlready = { kind: "already" }

export type UploadMetadataStoreDeps = {
  uploadKv: KeyValueStoreCasAndConditional<UploadRecord>
}

export class UploadMetadataStore {
  public constructor(private readonly deps: UploadMetadataStoreDeps) {}

  private keyForUpload(uploadId: UploadId): string {
    return uploadId
  }

  private invalidTransition(
    expected: readonly string[],
    actual: string,
  ): UploadMetadataStoreWriteResult {
    return { kind: "invalid_transition", expected, actual }
  }

  private mapCasResult(
    kind: "written" | "conflict" | "not_found",
  ): UploadMetadataStoreWriteResult {
    if (kind === "written") return WRITTEN
    if (kind === "conflict") return { kind: "conflict" }
    return { kind: "not_found" }
  }

  async get(id: UploadId): Promise<UploadRecord | null> {
    const key = this.keyForUpload(id)
    const res = await this.deps.uploadKv.get(key)

    return res.kind === "found" ? res.value : null
  }

  async create(input: CreateUploadInput, at: Date): Promise<UploadStoreWriteResult> {
    const record: AwaitingUpload = {
      id: input.id,
      staging: input.staging,
      status: "awaiting_upload",
      createdAt: at,
      updatedAt: at,
      ...(input.filename !== undefined && { filename: input.filename }),
      ...(input.contentType !== undefined && { contentType: input.contentType }),
      ...(input.expectedSizeBytes !== undefined && {
        expectedSizeBytes: input.expectedSizeBytes,
      }),
    }

    const res = await this.deps.uploadKv.setIfNotExists(
      this.keyForUpload(input.id),
      record,
    )

    return res.kind === "written" ? WRITTEN : ALREADY
  }

  async markQueued(
    input: MarkQueuedInput,
    at: Date,
  ): Promise<UploadMetadataStoreWriteResult> {
    const key = this.keyForUpload(input.uploadId)
    const versionedRecord = await this.deps.uploadKv.getVersioned(key)

    if (versionedRecord.kind !== "found") return { kind: "not_found" }

    const upload = versionedRecord.value

    if (upload.status === "queued") return ALREADY

    if (upload.status !== "awaiting_upload") {
      return this.invalidTransition(["awaiting_upload", "queued"], upload.status)
    }

    const next: UploadQueued = {
      ...upload,
      status: "queued",
      queuedAt: at,
      updatedAt: at,
      ...(input.filename !== undefined && { filename: input.filename }),
      ...(input.contentType !== undefined && { contentType: input.contentType }),
      ...(input.expectedSizeBytes !== undefined && {
        expectedSizeBytes: input.expectedSizeBytes,
      }),
    }

    const write = await this.deps.uploadKv.setIfVersion(
      key,
      next,
      versionedRecord.version,
    )

    return this.mapCasResult(write.kind)
  }

  async markProcessing(
    input: MarkProcessingInput,
    at: Date,
  ): Promise<UploadMetadataStoreWriteResult> {
    const key = this.keyForUpload(input.uploadId)
    const versionedRecord = await this.deps.uploadKv.getVersioned(key)

    if (versionedRecord.kind !== "found") return { kind: "not_found" }

    const upload = versionedRecord.value

    if (upload.status === "processing") {
      const sameFilename = upload.filename === input.filename
      if (sameFilename) return ALREADY

      return this.invalidTransition(
        ["queued", "processing (same filename)"],
        "processing (different filename)",
      )
    }

    if (upload.status !== "queued") {
      return this.invalidTransition(["queued", "processing"], upload.status)
    }

    const next: UploadRecord = {
      ...upload,
      status: "processing",
      filename: input.filename,
      updatedAt: at,
    }

    const write = await this.deps.uploadKv.setIfVersion(
      key,
      next,
      versionedRecord.version,
    )

    return this.mapCasResult(write.kind)
  }

  async markFinalized(
    input: MarkFinalizedInput,
    at: Date,
  ): Promise<UploadMetadataStoreWriteResult> {
    const key = this.keyForUpload(input.uploadId)
    const versionedRecord = await this.deps.uploadKv.getVersioned(key)

    if (versionedRecord.kind !== "found") return { kind: "not_found" }

    const upload = versionedRecord.value

    if (upload.status === "finalized") {
      const sameFinalLocation =
        upload.final.bucket === input.final.bucket && upload.final.key === input.final.key

      const sameSize = upload.actualSizeBytes === input.actualSizeBytes

      if (sameFinalLocation && sameSize) return ALREADY

      return this.invalidTransition(
        ["finalized (same final location and size)"],
        "finalized (different final location or size)",
      )
    }

    if (upload.status !== "processing") {
      return this.invalidTransition(["processing", "finalized"], upload.status)
    }

    const next: UploadRecord = {
      ...upload,
      status: "finalized",
      final: input.final,
      actualSizeBytes: input.actualSizeBytes,
      finalizedAt: at,
      updatedAt: at,
    }

    const write = await this.deps.uploadKv.setIfVersion(
      key,
      next,
      versionedRecord.version,
    )

    return this.mapCasResult(write.kind)
  }

  async markFailed(
    input: MarkFailedInput,
    at: Date,
  ): Promise<UploadMetadataStoreWriteResult> {
    const key = this.keyForUpload(input.uploadId)
    const versionedRecord = await this.deps.uploadKv.getVersioned(key)

    if (versionedRecord.kind !== "found") return { kind: "not_found" }

    const upload = versionedRecord.value

    if (upload.status === "failed") {
      return upload.failureReason === input.reason
        ? ALREADY
        : {
            kind: "invalid_transition",
            expected: ["failed (same reason)"],
            actual: "failed (different reason)",
          }
    }

    if (upload.status !== "processing") {
      return this.invalidTransition(["processing", "failed"], upload.status)
    }

    const next: UploadRecord = {
      ...upload,
      status: "failed",
      failureReason: input.reason,
      updatedAt: at,
    }

    const write = await this.deps.uploadKv.setIfVersion(
      key,
      next,
      versionedRecord.version,
    )

    return this.mapCasResult(write.kind)
  }
}
