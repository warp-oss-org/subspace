import { type Brand, prefixed, uuidV4 } from "@subspace/id"
import type { UploadId } from "./upload.model"

export type JobId = Brand<string, "JobId">
export const JobId = prefixed<JobId>("job_", uuidV4)

export type JobStatus = "pending" | "running" | "completed" | "failed"

export interface FinalizeJob {
  id: JobId
  uploadId: UploadId
  status: JobStatus

  /**
   * Number of times this job has been attempted.
   * Increments after each failed attempt.
   */
  attempt: number

  /**
   * Earliest time at which this job is eligible to be claimed
   * by the worker. Used to implement retry backoff.
   */
  runAt: Date

  /**
   * Error message from the most recent failed attempt, if any.
   */
  lastError?: string

  createdAt: Date
  updatedAt: Date
}
