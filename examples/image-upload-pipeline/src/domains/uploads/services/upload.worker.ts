import { Readable } from "node:stream"
import type { DelayPolicy } from "@subspace/backoff"
import type { Clock, Milliseconds } from "@subspace/clock"
import { BaseError } from "@subspace/errors"
import type { IRetryExecutor, RetryConfig } from "@subspace/retry"
import type { StorageData } from "@subspace/storage"
import type { JobStore } from "../infra/job-store"
import type { UploadMetadataStoreRedis } from "../infra/upload-metadata-store.redis"
import type { UploadObjectStoreS3 } from "../infra/upload-object-store.s3"
import type { ImageProcessor, ProcessedImage } from "../model/image.processing.model"
import type { FinalizeJob } from "../model/job.model"
import type { PromotedVariant, UploadId } from "../model/upload.model"

export type UploadWorkerDeps = {
  clock: Clock
  retryExecutor: IRetryExecutor
  jobStore: JobStore
  uploadMetadataStore: UploadMetadataStoreRedis
  uploadObjectStore: UploadObjectStoreS3
  imageProcessor: ImageProcessor
}

export type UploadWorkerConfig = {
  /** Max concurrent jobs being processed */
  concurrency: number

  /** How long to wait when at max concurrency */
  capacityPollMs: Milliseconds

  /** How long to wait when draining in-flight jobs during stop */
  drainPollMs: Milliseconds

  /** Backoff config for idle polling (no jobs available) */
  idleBackoff: DelayPolicy

  /** Retry config for IO operations (Redis, S3) */
  ioRetryConfig: RetryConfig<unknown, Error>

  /** Delay before retrying a failed job, given attempt number */
  jobRetryDelay: DelayPolicy

  /** Max attempts before marking job as permanently failed */
  maxJobAttempts: number
}

type PreparedJob = {
  job: FinalizeJob
  filename: string
  contentType: string | undefined
}

export class UploadFinalizationWorker {
  private running = false
  private inFlightCount = 0
  private consecutiveIdlePolls = 0

  private readonly idleBackoff: DelayPolicy
  private stopSignal: { promise: Promise<void>; trigger: () => void }

  constructor(
    private readonly deps: UploadWorkerDeps,
    private readonly config: UploadWorkerConfig,
  ) {
    this.idleBackoff = config.idleBackoff
    this.stopSignal = this.createStopSignal()
  }

  async start(): Promise<void> {
    this.running = true
    this.stopSignal = this.createStopSignal()

    void this.runLoop()
  }

  async stop(): Promise<void> {
    this.running = false
    this.stopSignal.trigger()

    await this.drainInFlightJobs()
  }

  private async runLoop(): Promise<void> {
    while (this.running) {
      try {
        const availableCapacity = this.config.concurrency - this.inFlightCount

        if (availableCapacity <= 0) {
          await this.sleep(this.config.capacityPollMs)
          continue
        }

        const candidates = await this.fetchDueJobs(availableCapacity)

        if (candidates.length === 0) {
          await this.waitWithIdleBackoff()
          continue
        }

        this.consecutiveIdlePolls = 0
        await this.claimAndProcessJobs(candidates)
      } catch {
        // Best-effort: keep the worker alive; idle backoff before retrying.
        await this.waitWithIdleBackoff()
      }
    }
  }

  private async claimAndProcessJobs(candidates: FinalizeJob[]): Promise<void> {
    for (const candidate of candidates) {
      if (this.shouldStopClaiming()) break

      const prepared = await this.tryClaimAndPrepare(candidate)
      if (!prepared) continue

      this.spawnJobProcessor(prepared)
    }
  }

  private async tryClaimAndPrepare(candidate: FinalizeJob): Promise<PreparedJob | null> {
    const claimed = await this.tryClaim(candidate)
    if (!claimed) return null

    const upload = await this.withIoRetry(() =>
      this.deps.uploadMetadataStore.get(claimed.uploadId),
    )

    if (!upload || upload.status !== "queued") {
      return null
    }

    if (!upload.filename) {
      await this.failJobAndUpload(
        claimed,
        upload.id,
        UploadWorkerError.missingFilename(upload.id).message,
      )
      return null
    }

    const transitioned = await this.transitionToProcessing(upload.id, upload.filename)
    if (!transitioned) return null

    return {
      job: claimed,
      filename: upload.filename,
      contentType: upload.contentType,
    }
  }

  private async tryClaim(candidate: FinalizeJob): Promise<FinalizeJob | null> {
    return this.withIoRetry(() => this.deps.jobStore.tryClaim(candidate.id, this.now()))
  }

  private async transitionToProcessing(
    uploadId: UploadId,
    filename: string,
  ): Promise<boolean> {
    const result = await this.withIoRetry(() =>
      this.deps.uploadMetadataStore.markProcessing({ uploadId, filename }, this.now()),
    )

    return result.kind === "written" || result.kind === "already"
  }

  private spawnJobProcessor(prepared: PreparedJob): void {
    this.inFlightCount++

    void this.processJob(prepared).finally(() => {
      this.inFlightCount--
    })
  }

  private async processJob(prepared: PreparedJob): Promise<void> {
    try {
      await this.finalizeUpload(prepared)
      await this.markJobCompleted(prepared.job)
    } catch (err) {
      await this.handleJobFailure(prepared.job, err)
    }
  }

  private async finalizeUpload(prepared: PreparedJob): Promise<void> {
    const { job, filename, contentType } = prepared

    const upload = await this.withIoRetry(() =>
      this.deps.uploadMetadataStore.get(job.uploadId),
    )

    if (!upload) {
      throw UploadWorkerError.uploadNotFound(job.uploadId)
    }

    if (upload.status !== "processing") {
      throw UploadWorkerError.invalidUploadState(job.uploadId, upload.status)
    }

    const stagingObject = await this.withIoRetry(() =>
      this.deps.uploadObjectStore.getStagingObject({ uploadId: upload.id, filename }),
    )

    if (!stagingObject || !stagingObject.metadata) {
      throw UploadWorkerError.stagingObjectMissing(upload.id, filename)
    }

    const processed = await this.deps.imageProcessor.process({
      data: this.toReadable(stagingObject.body),
      contentType: contentType ?? "application/octet-stream",
    })

    const promotedVariants = await this.uploadVariants(upload.id, filename, processed)

    const originalVariant = promotedVariants.find((v) => v.variant === "original")
    if (!originalVariant) {
      throw UploadWorkerError.finalizationFailed(upload.id, "missing_original_variant")
    }

    const result = await this.withIoRetry(() =>
      this.deps.uploadMetadataStore.markFinalized(
        {
          uploadId: upload.id,
          final: { bucket: originalVariant.bucket, key: originalVariant.key },
          actualSize: stagingObject.sizeInBytes,
          variants: promotedVariants,
        },
        this.now(),
      ),
    )

    if (result.kind !== "written" && result.kind !== "already") {
      throw UploadWorkerError.finalizationFailed(upload.id, result.kind)
    }
  }

  private async uploadVariants(
    uploadId: UploadId,
    filename: string,
    processed: ProcessedImage,
  ): Promise<PromotedVariant[]> {
    return Promise.all(
      processed.variants.map(async (variant) => {
        const variantFilename = this.buildVariantFilename(filename, variant.variant)

        const ref = await this.withIoRetry(() =>
          this.deps.uploadObjectStore.putFinalObject({
            uploadId,
            filename: variantFilename,
            data: variant.data,
            contentType: variant.contentType,
          }),
        )

        return {
          variant: variant.variant,
          bucket: ref.bucket,
          key: ref.key,
        }
      }),
    )
  }

  private buildVariantFilename(filename: string, variant: string): string {
    if (variant === "original") return filename

    const lastDot = filename.lastIndexOf(".")
    if (lastDot === -1) {
      return `${filename}-${variant}`
    }

    return `${filename.slice(0, lastDot)}-${variant}${filename.slice(lastDot)}`
  }

  private async handleJobFailure(job: FinalizeJob, err: unknown): Promise<void> {
    const reason = err instanceof Error ? err.message : "unknown_error"
    const isRetryable = err instanceof BaseError && err.isRetryable
    const attemptsExhausted = job.attempt + 1 > this.config.maxJobAttempts

    if (isRetryable && !attemptsExhausted) {
      await this.scheduleJobRetry(job, reason)
    } else {
      await this.markJobPermanentlyFailed(job, reason)
    }
  }

  private async markJobPermanentlyFailed(
    job: FinalizeJob,
    reason: string,
  ): Promise<void> {
    const at = this.now()

    try {
      await this.withIoRetry(() => this.deps.jobStore.markFailed(job.id, at, reason))
      await this.withIoRetry(() =>
        this.deps.uploadMetadataStore.markFailed({ uploadId: job.uploadId, reason }, at),
      )
    } catch {
      // Best-effort: lease expires and job gets reclaimed
    }
  }

  private async scheduleJobRetry(job: FinalizeJob, reason: string): Promise<void> {
    const now = this.now()
    const nextAttempt = job.attempt + 1
    const delay = this.config.jobRetryDelay.getDelay(nextAttempt)
    const nextRunAt = new Date(now.getTime() + delay.milliseconds)

    try {
      await this.withIoRetry(() =>
        this.deps.jobStore.reschedule(job.id, nextRunAt, now, reason),
      )
    } catch {
      // Best-effort: lease expires and job gets reclaimed
    }
  }

  private async failJobAndUpload(
    job: FinalizeJob,
    uploadId: UploadId,
    reason: string,
  ): Promise<void> {
    const at = this.now()

    try {
      await this.withIoRetry(() => this.deps.jobStore.markFailed(job.id, at, reason))
      await this.withIoRetry(() =>
        this.deps.uploadMetadataStore.markFailed({ uploadId, reason }, at),
      )
    } catch {
      // Best-effort: lease expires and job gets reclaimed
    }
  }

  private createStopSignal(): { promise: Promise<void>; trigger: () => void } {
    let trigger!: () => void
    const promise = new Promise<void>((resolve) => {
      trigger = resolve
    })
    return { promise, trigger }
  }

  private async drainInFlightJobs(): Promise<void> {
    while (this.inFlightCount > 0) {
      await this.sleep(this.config.drainPollMs)
    }
  }

  private async fetchDueJobs(limit: number): Promise<FinalizeJob[]> {
    return this.withIoRetry(() => this.deps.jobStore.listDue(this.now(), limit))
  }

  private async waitWithIdleBackoff(): Promise<void> {
    this.consecutiveIdlePolls++
    const delay = this.idleBackoff.getDelay(this.consecutiveIdlePolls)

    await Promise.race([
      this.sleep(delay.milliseconds as Milliseconds),
      this.stopSignal.promise,
    ])
  }

  private shouldStopClaiming(): boolean {
    return !this.running || this.inFlightCount >= this.config.concurrency
  }

  private now(): Date {
    return this.deps.clock.now()
  }

  private sleep(ms: Milliseconds): Promise<void> {
    return this.deps.clock.sleep(ms)
  }

  private withIoRetry<T>(fn: () => Promise<T>): Promise<T> {
    return this.deps.retryExecutor.execute(
      fn,
      this.config.ioRetryConfig as RetryConfig<T, Error>,
    )
  }

  private async markJobCompleted(job: FinalizeJob): Promise<void> {
    await this.withIoRetry(() => this.deps.jobStore.markCompleted(job.id, this.now()))
  }

  private toReadable(data: StorageData): Readable {
    if (data instanceof Buffer) {
      return Readable.from(data)
    }

    if (data instanceof Uint8Array) {
      return Readable.from(Buffer.from(data))
    }

    return data
  }
}

export type UploadWorkerErrorCode =
  | "upload_not_found"
  | "invalid_upload_state"
  | "staging_object_missing"
  | "finalization_failed"
  | "missing_filename"

export class UploadWorkerError extends BaseError<UploadWorkerErrorCode> {
  static uploadNotFound(uploadId: string): UploadWorkerError {
    return new UploadWorkerError("Upload not found", {
      code: "upload_not_found",
      context: { uploadId },
      isRetryable: false,
    })
  }

  static invalidUploadState(uploadId: string, status: string): UploadWorkerError {
    return new UploadWorkerError("Invalid upload state", {
      code: "invalid_upload_state",
      context: { uploadId, status },
      isRetryable: false,
    })
  }

  static stagingObjectMissing(uploadId: string, filename: string): UploadWorkerError {
    return new UploadWorkerError("Staging object missing", {
      code: "staging_object_missing",
      context: { uploadId, filename },
      isRetryable: true,
    })
  }

  static finalizationFailed(uploadId: string, result: string): UploadWorkerError {
    return new UploadWorkerError("Failed to finalize upload", {
      code: "finalization_failed",
      context: { uploadId, resultKind: result },
      isRetryable: false,
    })
  }

  static missingFilename(uploadId: string): UploadWorkerError {
    return new UploadWorkerError("Missing filename for processing", {
      code: "missing_filename",
      context: { uploadId },
      isRetryable: false,
    })
  }
}
