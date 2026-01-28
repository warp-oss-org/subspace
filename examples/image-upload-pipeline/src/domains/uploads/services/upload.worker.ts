import type { DelayPolicy } from "@subspace/backoff"
import type { Clock, Milliseconds } from "@subspace/clock"
import type { Logger } from "@subspace/logger"
import type { IRetryExecutor, RetryConfig } from "@subspace/retry"
import type { FinalizeJob } from "../model/job.model"
import type { JobStore } from "./job-store"
import type { UploadOrchestrator } from "./upload-orchestrator"

export type UploadWorkerDeps = {
  clock: Clock
  logger: Logger
  retryExecutor: IRetryExecutor
  jobStore: JobStore
  orchestrator: UploadOrchestrator
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

  /** Retry config for IO operations (Redis, S3, etc.) */
  ioRetryConfig: RetryConfig<unknown, Error>

  /** Delay policy for retrying failed jobs */
  jobRetryDelay: DelayPolicy

  /** Max attempts before marking job as permanently failed */
  maxJobAttempts: number
}

export class UploadFinalizationWorker {
  private running = false
  private inFlightCount = 0
  private consecutiveIdlePolls = 0

  private stopSignal: { promise: Promise<void>; trigger: () => void }

  constructor(
    private readonly deps: UploadWorkerDeps,
    private readonly config: UploadWorkerConfig,
  ) {
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

  /**
   * Main polling loop.
   *
   * Responsible only for:
   * - discovering jobs
   * - claiming capacity
   * - dispatching execution
   *
   * All domain logic lives in the orchestrator.
   */
  private async runLoop(): Promise<void> {
    while (this.running) {
      try {
        const availableCapacity = this.config.concurrency - this.inFlightCount

        if (availableCapacity <= 0) {
          await this.sleep(this.config.capacityPollMs)
          continue
        }

        const jobs = await this.fetchDueJobs(availableCapacity)

        if (jobs.length === 0) {
          await this.waitWithIdleBackoff()
          continue
        }

        this.consecutiveIdlePolls = 0
        await this.claimAndProcess(jobs)
      } catch {
        // Best-effort: keep the worker alive
        await this.waitWithIdleBackoff()
      }
    }
  }

  /**
   * Attempt to claim and process jobs.
   *
   * Uses CAS-based claiming to prevent duplicate processing
   * across multiple worker instances.
   */
  private async claimAndProcess(jobs: FinalizeJob[]): Promise<void> {
    for (const job of jobs) {
      if (this.shouldStopClaiming()) break

      const claimed = await this.withIoRetry(() =>
        this.deps.jobStore.tryClaim(job.id, this.now()),
      )

      if (!claimed) continue

      this.inFlightCount++
      void this.processJob(claimed).finally(() => {
        this.inFlightCount--
      })
    }
  }

  /**
   * Process a single job.
   *
   * The worker:
   * - delegates all logic to the orchestrator
   * - interprets the result
   * - performs job bookkeeping (retry / fail / complete)
   */
  private async processJob(job: FinalizeJob): Promise<void> {
    try {
      const result = await this.withIoRetry(() =>
        this.deps.orchestrator.finalizeUpload(job),
      )

      switch (result.kind) {
        case "finalized":
        case "already_finalized": {
          await this.withIoRetry(() =>
            this.deps.jobStore.markCompleted(job.id, this.now()),
          )
          return
        }

        case "retry": {
          await this.scheduleRetry(job, result.reason)
          return
        }

        case "failed": {
          await this.markPermanentlyFailed(job, result.reason)
          return
        }

        case "not_found": {
          await this.markPermanentlyFailed(job, "upload_not_found")
          return
        }
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown_error"

      await this.scheduleRetry(job, reason)
    }
  }

  /**
   * Retry scheduling logic (job-level).
   *
   * Uses configured backoff policy and caps retries.
   */
  private async scheduleRetry(job: FinalizeJob, reason: string): Promise<void> {
    const attemptsExhausted = job.attempt + 1 > this.config.maxJobAttempts

    if (attemptsExhausted) {
      await this.markPermanentlyFailed(job, reason)
      return
    }

    const delay = this.config.jobRetryDelay.getDelay(job.attempt + 1)
    const nextRunAt = new Date(this.now().getTime() + delay.milliseconds)

    try {
      await this.withIoRetry(() =>
        this.deps.jobStore.reschedule(job.id, nextRunAt, this.now(), reason),
      )
    } catch {
      // Best-effort: lease expiration will allow reclaim
    }
  }

  /**
   * Marks a job as permanently failed.
   *
   * Upload state has already been handled by the orchestrator.
   */
  private async markPermanentlyFailed(job: FinalizeJob, reason: string): Promise<void> {
    try {
      await this.withIoRetry(() =>
        this.deps.jobStore.markFailed(job.id, this.now(), reason),
      )
    } catch {
      // Best-effort: lease expiration will allow reclaim
    }
  }

  private async fetchDueJobs(limit: number): Promise<FinalizeJob[]> {
    return this.withIoRetry(() => this.deps.jobStore.listDue(this.now(), limit))
  }

  private async waitWithIdleBackoff(): Promise<void> {
    this.consecutiveIdlePolls++
    const delay = this.config.idleBackoff.getDelay(this.consecutiveIdlePolls)

    await Promise.race([
      this.sleep(delay.milliseconds as Milliseconds),
      this.stopSignal.promise,
    ])
  }

  private shouldStopClaiming(): boolean {
    return !this.running || this.inFlightCount >= this.config.concurrency
  }

  private async drainInFlightJobs(): Promise<void> {
    while (this.inFlightCount > 0) {
      await this.sleep(this.config.drainPollMs)
    }
  }

  private createStopSignal(): { promise: Promise<void>; trigger: () => void } {
    let trigger!: () => void
    const promise = new Promise<void>((resolve) => {
      trigger = resolve
    })
    return { promise, trigger }
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
}
