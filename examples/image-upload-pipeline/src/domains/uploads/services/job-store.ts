import type { Milliseconds } from "@subspace/clock"
import type { KeyValueStore, KeyValueStoreCas } from "@subspace/kv"
import type { FinalizeJob, JobId } from "../model/job.model"

export type JobIndex = {
  jobIds: JobId[]
}

export type JobStoreDeps = {
  jobKv: KeyValueStoreCas<FinalizeJob>
  indexKv: KeyValueStore<JobIndex>
}

export type JobStoreOptions = {
  leaseDurationMs: Milliseconds
}

export class JobStore {
  public constructor(
    private readonly deps: JobStoreDeps,
    private readonly opts: JobStoreOptions,
  ) {}

  async get(id: JobId): Promise<FinalizeJob | null> {
    const key = this.keyForJob(id)
    const res = await this.deps.jobKv.get(key)

    return res.kind === "found" ? res.value : null
  }

  /**
   * Enqueue a new job for processing.
   *
   * @remarks
   * Writing the job record and updating the index are not atomic.
   * If the process crashes between these operations, the job may be orphaned
   * (present in storage but missing from the index).
   *
   * The job index is best-effort and should be considered rebuildable
   * from authoritative job records.
   */
  async enqueue(job: FinalizeJob): Promise<void> {
    const key = this.keyForJob(job.id)

    await this.deps.jobKv.set(key, job)
    await this.addToIndex(job.id)
  }

  async markCompleted(id: JobId, at: Date): Promise<void> {
    const job = await this.get(id)
    if (!job) return

    const key = this.keyForJob(id)
    await this.deps.jobKv.set(key, {
      ...job,
      status: "completed",
      updatedAt: at,
    })

    await this.removeFromIndex(id)
  }

  async markFailed(id: JobId, at: Date, reason: string): Promise<void> {
    const job = await this.get(id)
    if (!job) return

    const key = this.keyForJob(id)
    await this.deps.jobKv.set(key, {
      ...job,
      status: "failed",
      lastError: reason,
      updatedAt: at,
    })

    await this.removeFromIndex(id)
  }

  async reschedule(
    id: JobId,
    nextRunAt: Date,
    at: Date,
    lastError?: string,
  ): Promise<void> {
    const job = await this.get(id)

    if (!job) return

    const key = this.keyForJob(id)
    await this.deps.jobKv.set(key, {
      ...job,
      status: "pending",
      attempt: job.attempt + 1,
      runAt: nextRunAt,
      updatedAt: at,
      ...(lastError && { lastError }),
    })
  }

  /**
   * List jobs eligible for execution.
   *
   * @remarks
   * - Performs a linear scan over the job index (O(n)).
   * - The index is best-effort and not updated atomically with job writes.
   *   In production systems, indexes should be rebuildable from job records.
   * - Jobs with status === "running" are included if their lease has expired
   *   (runAt <= now), allowing crashed workers' jobs to be reclaimed.
   */
  async listDue(now: Date, limit: number): Promise<FinalizeJob[]> {
    const index = await this.loadIndex()

    if (!index) return []

    const entries = await this.deps.jobKv.getMany(
      index.jobIds.map((id) => this.keyForJob(id)),
    )

    const due: FinalizeJob[] = []

    for (const res of entries.values()) {
      if (res.kind === "not_found") continue

      const job = res.value

      const isEligibleStatus = job.status === "pending" || job.status === "running"

      const leaseExpired = job.runAt <= now

      if (!isEligibleStatus || !leaseExpired) continue

      due.push(job)

      if (due.length >= limit) break
    }

    return due
  }

  /**
   * Attempt to claim a job for processing.
   *
   * @remarks
   * Uses compare-and-swap (CAS) to ensure only one worker can claim a job.
   * Jobs with an expired lease (status === "running" and runAt <= now)
   * may be reclaimed.
   */
  async tryClaim(id: JobId, at: Date): Promise<FinalizeJob | null> {
    const key = this.keyForJob(id)

    const versioned = await this.deps.jobKv.getVersioned(key)
    if (versioned.kind !== "found") return null

    const job = versioned.value

    const isPending = job.status === "pending"
    const isExpiredRunning = job.status === "running" && job.runAt <= at

    if (!isPending && !isExpiredRunning) {
      return null
    }

    const leaseUntil = new Date(at.getTime() + this.opts.leaseDurationMs)

    const claimed: FinalizeJob = {
      ...job,
      status: "running",
      runAt: leaseUntil,
      updatedAt: at,
    }

    const write = await this.deps.jobKv.setIfVersion(key, claimed, versioned.version)

    if (write.kind !== "written") return null

    return claimed
  }

  private async loadIndex(): Promise<JobIndex | null> {
    const key = this.keyForIndex()
    const res = await this.deps.indexKv.get(key)

    return res.kind === "found" ? res.value : null
  }

  private async addToIndex(jobId: JobId): Promise<void> {
    const existing = await this.loadIndex()

    const next: JobIndex = existing
      ? { jobIds: [...existing.jobIds, jobId] }
      : { jobIds: [jobId] }

    await this.deps.indexKv.set(this.keyForIndex(), next)
  }

  private async removeFromIndex(jobId: JobId): Promise<void> {
    const existing = await this.loadIndex()
    if (!existing) return

    const next: JobIndex = {
      jobIds: existing.jobIds.filter((id) => id !== jobId),
    }

    await this.deps.indexKv.set(this.keyForIndex(), next)
  }

  private keyForJob(jobId: JobId): string {
    return jobId
  }

  private keyForIndex(): string {
    return "index"
  }
}
