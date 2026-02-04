import { FakeClock } from "@subspace/clock"
import {
  createMemoryKeyValueStore,
  createMemoryKeyValueStoreCas,
  type KeyValueStore,
  type KeyValueStoreCas,
} from "@subspace/kv"
import { beforeEach, describe, expect, it } from "vitest"
import { createJsonCodec } from "../../../../lib"
import { type FinalizeJob, JobId } from "../../model/job.model"
import type { UploadId } from "../../model/upload.model"
import { type JobIndex, JobStore } from "../job-store"

describe("JobStore", () => {
  const leaseDurationMs = 30_000

  let store: JobStore

  let clock: FakeClock
  let jobKv: KeyValueStoreCas<FinalizeJob>
  let indexKv: KeyValueStore<JobIndex>

  beforeEach(() => {
    clock = new FakeClock()

    jobKv = createMemoryKeyValueStoreCas<FinalizeJob>({
      clock,
      opts: { maxEntries: 1000 },
      codec: createJsonCodec(),
    })

    indexKv = createMemoryKeyValueStore<JobIndex>({
      clock,
      opts: { maxEntries: 1000 },
      codec: createJsonCodec(),
    })

    store = new JobStore({ jobKv, indexKv }, { leaseDurationMs })
  })

  const createJob = (overrides: Partial<FinalizeJob> = {}): FinalizeJob => ({
    id: JobId.generate(),
    uploadId: `upload_${crypto.randomUUID()}` as UploadId,
    status: "pending",
    attempt: 0,
    runAt: clock.now(),
    createdAt: clock.now(),
    updatedAt: clock.now(),
    ...overrides,
  })

  describe("get", () => {
    it("returns null when job does not exist", async () => {
      const result = await store.get(JobId.generate())

      expect(result).toBeNull()
    })

    it("returns the job when it exists", async () => {
      const job = createJob()
      await store.enqueue(job)

      const result = await store.get(job.id)

      expect(result).toEqual(job)
    })
  })

  describe("enqueue", () => {
    it("persists a new job that can be retrieved", async () => {
      const job = createJob()

      await store.enqueue(job)

      const result = await store.get(job.id)
      expect(result).toEqual(job)
    })

    it("overwrites an existing job with the same id", async () => {
      const job = createJob()
      await store.enqueue(job)

      const updatedJob = { ...job, attempt: 5 }
      await store.enqueue(updatedJob)

      const result = await store.get(job.id)
      expect(result?.attempt).toBe(5)
    })

    it("adds the job id to the index", async () => {
      const job = createJob()

      await store.enqueue(job)

      const dueJobs = await store.listDue(clock.now(), 10)
      expect(dueJobs.map((j) => j.id)).toContain(job.id)
    })
  })

  describe("markCompleted", () => {
    it("sets status to completed and updates timestamp", async () => {
      const job = createJob()
      await store.enqueue(job)
      clock.advance(1000)

      await store.markCompleted(job.id, clock.now())

      const result = await store.get(job.id)
      expect(result?.status).toBe("completed")
      expect(result?.updatedAt).toEqual(clock.now())
    })

    it("removes the job from the index", async () => {
      const job = createJob()
      await store.enqueue(job)

      await store.markCompleted(job.id, clock.now())

      const dueJobs = await store.listDue(clock.now(), 10)
      expect(dueJobs.map((j) => j.id)).not.toContain(job.id)
    })

    it("does nothing when job does not exist", async () => {
      await expect(
        store.markCompleted(JobId.generate(), clock.now()),
      ).resolves.not.toThrow()
    })

    it("preserves other job fields", async () => {
      const job = createJob({ attempt: 3 })
      await store.enqueue(job)

      await store.markCompleted(job.id, clock.now())

      const result = await store.get(job.id)
      expect(result?.attempt).toBe(3)
      expect(result?.uploadId).toBe(job.uploadId)
    })
  })

  describe("markFailed", () => {
    it("sets status to failed with reason and updates timestamp", async () => {
      const job = createJob()
      await store.enqueue(job)
      clock.advance(1000)

      await store.markFailed(job.id, clock.now(), "processing_error")

      const result = await store.get(job.id)
      expect(result?.status).toBe("failed")
      expect(result?.lastError).toBe("processing_error")
      expect(result?.updatedAt).toEqual(clock.now())
    })

    it("removes the job from the index", async () => {
      const job = createJob()
      await store.enqueue(job)

      await store.markFailed(job.id, clock.now(), "error")

      const dueJobs = await store.listDue(clock.now(), 10)
      expect(dueJobs.map((j) => j.id)).not.toContain(job.id)
    })

    it("does nothing when job does not exist", async () => {
      await expect(
        store.markFailed(JobId.generate(), clock.now(), "error"),
      ).resolves.not.toThrow()
    })

    it("preserves other job fields", async () => {
      const job = createJob({ attempt: 2 })
      await store.enqueue(job)

      await store.markFailed(job.id, clock.now(), "error")

      const result = await store.get(job.id)
      expect(result?.attempt).toBe(2)
      expect(result?.uploadId).toBe(job.uploadId)
    })
  })

  describe("reschedule", () => {
    it("sets status back to pending", async () => {
      const job = createJob({ status: "running" })
      await store.enqueue(job)

      await store.reschedule(job.id, clock.now(), { nextRunAt: clock.now() })

      const result = await store.get(job.id)
      expect(result?.status).toBe("pending")
    })

    it("increments the attempt counter", async () => {
      const job = createJob({ attempt: 2 })
      await store.enqueue(job)

      await store.reschedule(job.id, clock.now(), { nextRunAt: clock.now() })

      const result = await store.get(job.id)
      expect(result?.attempt).toBe(3)
    })

    it("updates runAt to the provided next run time", async () => {
      const job = createJob()
      await store.enqueue(job)
      const nextRun = new Date(clock.now().getTime() + 60000)

      await store.reschedule(job.id, clock.now(), { nextRunAt: nextRun })

      const result = await store.get(job.id)
      expect(result?.runAt).toEqual(nextRun)
    })

    it("sets lastError when provided", async () => {
      const job = createJob()
      await store.enqueue(job)

      await store.reschedule(job.id, clock.now(), {
        nextRunAt: clock.now(),
        lastError: "timeout",
      })

      const result = await store.get(job.id)
      expect(result?.lastError).toBe("timeout")
    })

    it("does not set lastError when not provided", async () => {
      const job = createJob({ lastError: "previous_error" })
      await store.enqueue(job)

      await store.reschedule(job.id, clock.now(), { nextRunAt: clock.now() })

      const result = await store.get(job.id)
      expect(result?.lastError).toBe("previous_error")
    })

    it("does nothing when job does not exist", async () => {
      await expect(
        store.reschedule(JobId.generate(), clock.now(), { nextRunAt: clock.now() }),
      ).resolves.not.toThrow()
    })
  })

  describe("listDue", () => {
    it("returns empty array when no jobs exist", async () => {
      const result = await store.listDue(clock.now(), 10)

      expect(result).toEqual([])
    })

    it("returns pending jobs where runAt <= now", async () => {
      const job = createJob({ status: "pending", runAt: clock.now() })
      await store.enqueue(job)

      const result = await store.listDue(clock.now(), 10)

      expect(result.map((j) => j.id)).toContain(job.id)
    })

    it("excludes pending jobs where runAt > now", async () => {
      const futureJob = createJob({
        status: "pending",
        runAt: new Date(clock.now().getTime() + 60000),
      })
      await store.enqueue(futureJob)

      const result = await store.listDue(clock.now(), 10)

      expect(result.map((j) => j.id)).not.toContain(futureJob.id)
    })

    it("returns running jobs with expired lease (runAt <= now)", async () => {
      const job = createJob({ status: "running", runAt: clock.now() })
      await store.enqueue(job)

      const result = await store.listDue(clock.now(), 10)

      expect(result.map((j) => j.id)).toContain(job.id)
    })

    it("excludes running jobs with active lease (runAt > now)", async () => {
      const job = createJob({
        status: "running",
        runAt: new Date(clock.now().getTime() + 60000),
      })
      await store.enqueue(job)

      const result = await store.listDue(clock.now(), 10)

      expect(result.map((j) => j.id)).not.toContain(job.id)
    })

    it("excludes completed jobs", async () => {
      const job = createJob({ status: "completed" })
      await store.enqueue(job)

      const result = await store.listDue(clock.now(), 10)

      expect(result.map((j) => j.id)).not.toContain(job.id)
    })

    it("excludes failed jobs", async () => {
      const job = createJob({ status: "failed" })
      await store.enqueue(job)

      const result = await store.listDue(clock.now(), 10)

      expect(result.map((j) => j.id)).not.toContain(job.id)
    })

    it("respects the limit parameter", async () => {
      const jobs = [createJob(), createJob(), createJob()]
      for (const job of jobs) {
        await store.enqueue(job)
      }

      const result = await store.listDue(clock.now(), 2)

      expect(result).toHaveLength(2)
    })

    it("handles index entries pointing to deleted jobs gracefully", async () => {
      const job = createJob()
      await store.enqueue(job)
      await jobKv.delete(job.id)

      const result = await store.listDue(clock.now(), 10)

      expect(result.map((j) => j.id)).not.toContain(job.id)
    })

    describe("ordering", () => {
      it("returns jobs sorted by runAt ascending", async () => {
        const early = createJob({ runAt: new Date(clock.now().getTime() - 2000) })
        const middle = createJob({ runAt: new Date(clock.now().getTime() - 1000) })
        const late = createJob({ runAt: clock.now() })

        await store.enqueue(late)
        await store.enqueue(early)
        await store.enqueue(middle)

        const result = await store.listDue(clock.now(), 10)

        expect(result[0]!.id).toBe(early.id)
        expect(result[1]!.id).toBe(middle.id)
        expect(result[2]!.id).toBe(late.id)
      })

      it("jobs with earlier runAt come before jobs with later runAt", async () => {
        const earlier = createJob({ runAt: new Date(clock.now().getTime() - 5000) })
        const later = createJob({ runAt: new Date(clock.now().getTime() - 1000) })

        await store.enqueue(later)
        await store.enqueue(earlier)

        const result = await store.listDue(clock.now(), 10)

        expect(result.indexOf(result.find((j) => j.id === earlier.id)!)).toBeLessThan(
          result.indexOf(result.find((j) => j.id === later.id)!),
        )
      })

      it("when limit is applied, returns the earliest jobs first", async () => {
        const earliest = createJob({ runAt: new Date(clock.now().getTime() - 3000) })
        const middle = createJob({ runAt: new Date(clock.now().getTime() - 2000) })
        const latest = createJob({ runAt: new Date(clock.now().getTime() - 1000) })

        await store.enqueue(latest)
        await store.enqueue(earliest)
        await store.enqueue(middle)

        const result = await store.listDue(clock.now(), 2)

        expect(result.map((j) => j.id)).toContain(earliest.id)
        expect(result.map((j) => j.id)).toContain(middle.id)
        expect(result.map((j) => j.id)).not.toContain(latest.id)
      })
    })
  })

  describe("tryClaim", () => {
    it("returns null when job does not exist", async () => {
      const result = await store.tryClaim(JobId.generate(), clock.now())

      expect(result).toBeNull()
    })

    it("claims a pending job and returns the updated job", async () => {
      const job = createJob({ status: "pending" })
      await store.enqueue(job)

      const result = await store.tryClaim(job.id, clock.now())

      expect(result).not.toBeNull()
      expect(result?.id).toBe(job.id)
    })

    it("sets status to running when claimed", async () => {
      const job = createJob({ status: "pending" })
      await store.enqueue(job)

      const result = await store.tryClaim(job.id, clock.now())

      expect(result?.status).toBe("running")
    })

    it("sets runAt to now + leaseDuration when claimed", async () => {
      const job = createJob({ status: "pending" })
      await store.enqueue(job)

      const result = await store.tryClaim(job.id, clock.now())
      const expectedRunAt = new Date(clock.now().getTime() + leaseDurationMs)

      expect(result?.runAt).toEqual(expectedRunAt)
    })

    it("updates the updatedAt timestamp when claimed", async () => {
      const job = createJob({ status: "pending" })
      await store.enqueue(job)
      clock.advance(5000)

      const result = await store.tryClaim(job.id, clock.now())

      expect(result?.updatedAt).toEqual(clock.now())
    })

    it("reclaims a running job with expired lease", async () => {
      const job = createJob({
        status: "running",
        runAt: new Date(clock.now().getTime() - 1000),
      })

      await store.enqueue(job)

      const result = await store.tryClaim(job.id, clock.now())

      expect(result).not.toBeNull()
      expect(result?.status).toBe("running")
    })

    it("returns null for running job with active lease", async () => {
      const job = createJob({
        status: "running",
        runAt: new Date(clock.now().getTime() + 60000),
      })
      await store.enqueue(job)

      const result = await store.tryClaim(job.id, clock.now())

      expect(result).toBeNull()
    })

    it("returns null for completed job", async () => {
      const job = createJob({ status: "completed" })
      await store.enqueue(job)

      const result = await store.tryClaim(job.id, clock.now())

      expect(result).toBeNull()
    })

    it("returns null for failed job", async () => {
      const job = createJob({ status: "failed" })
      await store.enqueue(job)

      const result = await store.tryClaim(job.id, clock.now())
      expect(result).toBeNull()
    })

    describe("concurrency", () => {
      it("only one caller wins when two attempt to claim simultaneously", async () => {
        const job = createJob({ status: "pending" })
        await store.enqueue(job)

        const results = await Promise.all([
          store.tryClaim(job.id, clock.now()),
          store.tryClaim(job.id, clock.now()),
        ])

        const successes = results.filter((r) => r !== null)
        expect(successes).toHaveLength(1)
      })

      it("losing caller receives null", async () => {
        const job = createJob({ status: "pending" })
        await store.enqueue(job)

        const results = await Promise.all([
          store.tryClaim(job.id, clock.now()),
          store.tryClaim(job.id, clock.now()),
        ])

        const failures = results.filter((r) => r === null)

        expect(failures).toHaveLength(1)
      })
    })
  })

  describe("index consistency", () => {
    it("index may contain ids for jobs that no longer exist", async () => {
      const job = createJob()
      await store.enqueue(job)
      await jobKv.delete(job.id)

      const result = await store.listDue(clock.now(), 10)

      expect(result.map((j) => j.id)).not.toContain(job.id)
    })

    it("jobs may exist that are not in the index (orphaned)", async () => {
      const job = createJob()
      await jobKv.set(job.id, job)

      const listed = await store.listDue(clock.now(), 10)

      const retrieved = await store.get(job.id)

      expect(retrieved).toEqual(job)
      expect(listed.map((j) => j.id)).not.toContain(job.id)
    })
  })
})
