import type { DelayPolicy } from "@subspace/backoff"
import { FakeClock, type Milliseconds } from "@subspace/clock"
import type { Logger } from "@subspace/logger"
import type { IRetryExecutor, RetryConfig } from "@subspace/retry"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mock } from "vitest-mock-extended"
import type { Mock } from "../../../../tests/mock"
import { type FinalizeJob, JobId } from "../../model/job.model"
import { UploadId } from "../../model/upload.model"
import type { JobStore } from "../job-store"
import { UploadFinalizationWorker, type UploadWorkerConfig } from "../upload.worker"
import type { UploadOrchestrator } from "../upload-orchestrator"

describe("UploadFinalizationWorker", () => {
  let worker: UploadFinalizationWorker | undefined
  let clock: FakeClock
  let logger: Mock<Logger>
  let jobStore: Mock<JobStore>
  let orchestrator: Mock<UploadOrchestrator>
  let retryExecutor: Mock<IRetryExecutor>

  const defaultIdleBackoff: DelayPolicy = {
    getDelay: (attempt: number) => ({
      milliseconds: Math.min(25 * attempt, 100) as Milliseconds,
    }),
  }

  const defaultJobRetryDelay: DelayPolicy = {
    getDelay: (attempt: number) => ({
      milliseconds: (1000 * attempt) as Milliseconds,
    }),
  }

  const config = (overrides: Partial<UploadWorkerConfig> = {}): UploadWorkerConfig => ({
    concurrency: 2,
    capacityPollMs: 50 as Milliseconds,
    drainPollMs: 10 as Milliseconds,
    idleBackoff: defaultIdleBackoff,
    ioRetryConfig: { maxAttempts: 3 } as RetryConfig<unknown, Error>,
    jobRetryDelay: defaultJobRetryDelay,
    maxJobAttempts: 3,
    ...overrides,
  })

  const makeWorker = (overrides: Partial<UploadWorkerConfig> = {}) => {
    worker = new UploadFinalizationWorker(
      { clock, logger, jobStore, orchestrator, retryExecutor },
      config(overrides),
    )
    return worker
  }

  const makeJob = (
    uploadId: UploadId = UploadId.generate(),
    overrides: Partial<FinalizeJob> = {},
  ): FinalizeJob => ({
    id: JobId.generate(),
    uploadId,
    status: "pending",
    attempt: 0,
    runAt: clock.now(),
    createdAt: clock.now(),
    updatedAt: clock.now(),
    ...overrides,
  })

  const flushMicrotasks = async () => {
    await Promise.resolve()
    await Promise.resolve()
  }

  const tick = async (ms: number) => {
    await clock.advance(ms as Milliseconds)
    await flushMicrotasks()
  }

  const tickUntil = async (
    predicate: () => boolean,
    opts: { stepMs?: number; maxSteps?: number } = {},
  ) => {
    const stepMs = opts.stepMs ?? 1
    const maxSteps = opts.maxSteps ?? 200
    for (let i = 0; i < maxSteps; i++) {
      if (predicate()) return
      await tick(stepMs)
    }
    throw new Error("tickUntil: predicate not satisfied within maxSteps")
  }

  const start = async () => {
    expect(worker).toBeDefined()
    await worker!.start()
    await tick(1)
  }

  const stop = async () => {
    if (!worker) return
    await worker.stop()
  }

  const givenNoJobs = () => {
    jobStore.listDue.mockResolvedValue([])
  }

  const givenRetryPassthrough = () => {
    retryExecutor.execute.mockImplementation((fn) => fn({} as any))
  }

  const givenJobFlow = (
    job: FinalizeJob,
    finalizeResult: Awaited<ReturnType<UploadOrchestrator["finalizeUpload"]>>,
  ) => {
    jobStore.listDue.mockResolvedValue([job])
    jobStore.tryClaim.mockResolvedValue(job)
    orchestrator.finalizeUpload.mockResolvedValue(finalizeResult as any)

    if (
      finalizeResult.kind === "finalized" ||
      finalizeResult.kind === "already_finalized"
    ) {
      jobStore.markCompleted.mockResolvedValue(undefined)
    }
  }

  const spyIdleBackoff = () => {
    const getDelay = vi.fn<(attempt: number) => { milliseconds: Milliseconds }>()
    getDelay.mockImplementation((attempt: number) => ({
      milliseconds: Math.min(25 * attempt, 100) as Milliseconds,
    }))
    return {
      getDelay,
      policy: { getDelay } as DelayPolicy,
    }
  }

  beforeEach(() => {
    clock = new FakeClock()
    logger = mock<Logger>()
    jobStore = mock<JobStore>()
    orchestrator = mock<UploadOrchestrator>()
    retryExecutor = mock<IRetryExecutor>()

    givenRetryPassthrough()
    givenNoJobs()
  })

  afterEach(async () => {
    await stop()
    worker = undefined
  })

  describe("start/stop basics", () => {
    it("begins polling for jobs after start()", async () => {
      makeWorker()
      await start()
      expect(jobStore.listDue).toHaveBeenCalled()
    })

    it("can be called after stop to restart", async () => {
      makeWorker()
      await start()
      await stop()

      jobStore.listDue.mockClear()

      await worker!.start()
      await tick(1)

      expect(jobStore.listDue).toHaveBeenCalled()
    })

    it("stop() stops future polling/claiming", async () => {
      makeWorker()
      await start()

      await stop()
      jobStore.listDue.mockClear()

      await tick(200)
      expect(jobStore.listDue).not.toHaveBeenCalled()
    })

    it("stop() resolves immediately if no jobs in flight", async () => {
      makeWorker()
      await worker!.start()
      await expect(worker!.stop()).resolves.toBeUndefined()
    })
  })

  describe("job polling", () => {
    it("fetches up to available capacity (concurrency - inFlight)", async () => {
      makeWorker({ concurrency: 5 })
      await start()
      expect(jobStore.listDue).toHaveBeenCalledWith(expect.any(Date), 5)
    })
    it("applies idle backoff when no jobs available", async () => {
      const sleepSpy = vi.spyOn(clock, "sleep")

      makeWorker()

      await start()

      await tickUntil(() => sleepSpy.mock.calls.length >= 1)

      const sleptMs = sleepSpy.mock.calls[0]?.[0]
      expect(sleptMs).toBe(25 as Milliseconds)

      expect(jobStore.listDue).toHaveBeenCalled()
    })

    it("resets idle backoff when jobs are found", async () => {
      const job = makeJob()
      const backoff = spyIdleBackoff()

      makeWorker({ idleBackoff: backoff.policy })

      jobStore.listDue
        .mockResolvedValueOnce([]) // idle #1
        .mockResolvedValueOnce([job]) // work
        .mockResolvedValueOnce([]) // idle again

      jobStore.tryClaim.mockResolvedValue(job)
      orchestrator.finalizeUpload.mockResolvedValue({
        kind: "finalized",
        uploadId: job.uploadId,
      })
      jobStore.markCompleted.mockResolvedValue(undefined)

      await worker!.start()

      // first idle => attempt 1
      await tickUntil(() => backoff.getDelay.mock.calls.length >= 1)
      expect(backoff.getDelay).toHaveBeenCalledWith(1)

      // allow idle sleep (25ms) + next poll to see job and process it
      await tick(30)
      await tick(1)

      // wait until we observe the *next* idle backoff call after having seen a job
      await tickUntil(() => backoff.getDelay.mock.calls.length >= 2)

      // after seeing a job, consecutiveIdlePolls should reset; next idle should call attempt 1 again
      expect(backoff.getDelay.mock.calls[1]?.[0]).toBe(1)

      await stop()
    })

    it("continues polling after transient errors", async () => {
      jobStore.listDue.mockRejectedValueOnce(new Error("DB down")).mockResolvedValue([])
      makeWorker()

      await worker!.start()
      await tick(1)

      await tick(30) // idle backoff then poll again
      expect(jobStore.listDue.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it("uses capacityPollMs when at max concurrency (does not fetch due jobs)", async () => {
      const job = makeJob()

      jobStore.listDue.mockResolvedValue([job])
      jobStore.tryClaim.mockResolvedValue(job)

      let release!: () => void
      const block = new Promise<void>((r) => {
        release = r
      })

      orchestrator.finalizeUpload.mockImplementation(async () => {
        await block
        return { kind: "finalized", uploadId: job.uploadId }
      })
      jobStore.markCompleted.mockResolvedValue(undefined)

      makeWorker({ concurrency: 1, capacityPollMs: 50 as Milliseconds })

      await start()
      jobStore.listDue.mockClear()

      await tick(60)
      expect(jobStore.listDue).not.toHaveBeenCalled()

      release()
      await tick(1)
    })
  })

  describe("job claiming", () => {
    it("claims job before processing", async () => {
      const job = makeJob()

      givenJobFlow(job, { kind: "finalized", uploadId: job.uploadId })
      makeWorker()

      await start()

      expect(jobStore.tryClaim).toHaveBeenCalledWith(job.id, expect.any(Date))
      expect(orchestrator.finalizeUpload).toHaveBeenCalledWith(job)
    })

    it("skips job if claim fails (another worker claimed it)", async () => {
      const job = makeJob()

      jobStore.listDue.mockResolvedValue([job])
      jobStore.tryClaim.mockResolvedValue(null)

      makeWorker()
      await start()

      expect(orchestrator.finalizeUpload).not.toHaveBeenCalled()
      expect(jobStore.markCompleted).not.toHaveBeenCalled()
      expect(jobStore.reschedule).not.toHaveBeenCalled()
      expect(jobStore.markFailed).not.toHaveBeenCalled()
    })

    it("stops claiming when stop signaled", async () => {
      const jobs = [makeJob(), makeJob(), makeJob()]
      jobStore.listDue.mockResolvedValue(jobs)

      let claimCount = 0
      jobStore.tryClaim.mockImplementation(async (id) => {
        claimCount++
        if (claimCount === 1) queueMicrotask(() => void worker!.stop())
        return jobs.find((j) => j.id === id) ?? null
      })

      orchestrator.finalizeUpload.mockResolvedValue({
        kind: "finalized",
        uploadId: jobs[0]!.uploadId,
      })
      jobStore.markCompleted.mockResolvedValue(undefined)

      makeWorker({ concurrency: 5 })

      await worker!.start()
      await tick(10)

      expect(claimCount).toBeLessThan(3)
    })

    it("stops claiming when concurrency limit reached", async () => {
      const jobs = [makeJob(), makeJob(), makeJob()]
      jobStore.listDue.mockResolvedValue(jobs)
      jobStore.tryClaim.mockImplementation(
        async (id) => jobs.find((j) => j.id === id) ?? null,
      )

      let release!: () => void
      const block = new Promise<void>((r) => {
        release = r
      })

      orchestrator.finalizeUpload.mockImplementation(async (job) => {
        await block
        return { kind: "finalized", uploadId: job.uploadId }
      })
      jobStore.markCompleted.mockResolvedValue(undefined)

      makeWorker({ concurrency: 2 })

      await worker!.start()
      await tick(1)

      expect(jobStore.tryClaim.mock.calls.length).toBe(2)

      release()
      await tick(1)
    })
  })

  describe("job completion", () => {
    it("marks job completed on finalized", async () => {
      const job = makeJob()
      givenJobFlow(job, { kind: "finalized", uploadId: job.uploadId })
      makeWorker()

      await start()

      expect(jobStore.markCompleted).toHaveBeenCalledWith(job.id, expect.any(Date))
    })

    it("marks job completed on already_finalized", async () => {
      const job = makeJob()
      givenJobFlow(job, { kind: "already_finalized", uploadId: job.uploadId })
      makeWorker()

      await start()

      expect(jobStore.markCompleted).toHaveBeenCalledWith(job.id, expect.any(Date))
    })
  })

  describe("job failure handling", () => {
    describe("retryable", () => {
      it("reschedules job if result is retry (and attempts not exhausted)", async () => {
        const job = makeJob(UploadId.generate(), { attempt: 0 })
        jobStore.listDue.mockResolvedValue([job])
        jobStore.tryClaim.mockResolvedValue(job)

        orchestrator.finalizeUpload.mockResolvedValue({
          kind: "retry",
          uploadId: job.uploadId,
          reason: "staging_object_missing",
        })
        jobStore.reschedule.mockResolvedValue(undefined)

        makeWorker({ maxJobAttempts: 3 })
        await start()

        expect(jobStore.reschedule).toHaveBeenCalledWith(
          job.id,
          expect.any(Date),
          expect.objectContaining({
            lastError: "staging_object_missing",
            nextRunAt: expect.any(Date),
          }),
        )
      })

      it("reschedules job on orchestrator exception", async () => {
        const job = makeJob(UploadId.generate(), { attempt: 0 })
        jobStore.listDue.mockResolvedValue([job])
        jobStore.tryClaim.mockResolvedValue(job)

        orchestrator.finalizeUpload.mockRejectedValue(new Error("boom"))
        jobStore.reschedule.mockResolvedValue(undefined)

        makeWorker({ maxJobAttempts: 3 })
        await start()

        expect(jobStore.reschedule).toHaveBeenCalledWith(
          job.id,
          expect.any(Date),
          expect.objectContaining({
            lastError: "boom",
            nextRunAt: expect.any(Date),
          }),
        )
      })

      it("marks job failed if max attempts exhausted", async () => {
        const job = makeJob(UploadId.generate(), { attempt: 3 })
        jobStore.listDue.mockResolvedValue([job])
        jobStore.tryClaim.mockResolvedValue(job)

        orchestrator.finalizeUpload.mockResolvedValue({
          kind: "retry",
          uploadId: job.uploadId,
          reason: "staging_object_missing",
        })
        jobStore.markFailed.mockResolvedValue(undefined)

        makeWorker({ maxJobAttempts: 3 })
        await start()

        expect(jobStore.markFailed).toHaveBeenCalledWith(
          job.id,
          expect.any(Date),
          "staging_object_missing",
        )
        expect(jobStore.reschedule).not.toHaveBeenCalled()
      })
    })

    describe("permanent failures", () => {
      it("marks job failed if result is failed", async () => {
        const job = makeJob()
        jobStore.listDue.mockResolvedValue([job])
        jobStore.tryClaim.mockResolvedValue(job)

        orchestrator.finalizeUpload.mockResolvedValue({
          kind: "failed",
          uploadId: job.uploadId,
          reason: "invalid_state",
        })
        jobStore.markFailed.mockResolvedValue(undefined)

        makeWorker()
        await start()

        expect(jobStore.markFailed).toHaveBeenCalledWith(
          job.id,
          expect.any(Date),
          "invalid_state",
        )
      })

      it("marks job failed with upload_not_found if result is not_found", async () => {
        const job = makeJob()
        jobStore.listDue.mockResolvedValue([job])
        jobStore.tryClaim.mockResolvedValue(job)

        orchestrator.finalizeUpload.mockResolvedValue({
          kind: "not_found",
          uploadId: job.uploadId,
        })
        jobStore.markFailed.mockResolvedValue(undefined)

        makeWorker()
        await start()

        expect(jobStore.markFailed).toHaveBeenCalledWith(
          job.id,
          expect.any(Date),
          "upload_not_found",
        )
      })
    })

    describe("failure handling errors", () => {
      it("swallows errors when marking job failed", async () => {
        const job = makeJob()
        jobStore.listDue.mockResolvedValue([job])
        jobStore.tryClaim.mockResolvedValue(job)

        orchestrator.finalizeUpload.mockResolvedValue({
          kind: "failed",
          uploadId: job.uploadId,
          reason: "error",
        })
        jobStore.markFailed.mockRejectedValue(new Error("DB error"))

        makeWorker()

        await worker!.start()
        await expect(tick(1)).resolves.not.toThrow()
      })

      it("swallows errors when rescheduling job", async () => {
        const job = makeJob(UploadId.generate(), { attempt: 0 })
        jobStore.listDue.mockResolvedValue([job])
        jobStore.tryClaim.mockResolvedValue(job)

        orchestrator.finalizeUpload.mockResolvedValue({
          kind: "retry",
          uploadId: job.uploadId,
          reason: "staging_object_missing",
        })
        jobStore.reschedule.mockRejectedValue(new Error("DB error"))

        makeWorker()

        await worker!.start()
        await expect(tick(1)).resolves.not.toThrow()
      })
    })
  })

  describe("concurrency + graceful shutdown", () => {
    it("processes jobs concurrently up to limit", async () => {
      const jobs = [makeJob(), makeJob(), makeJob()]
      jobStore.listDue.mockResolvedValue(jobs)
      jobStore.tryClaim.mockImplementation(
        async (id) => jobs.find((j) => j.id === id) ?? null,
      )

      let inFlight = 0
      let maxConcurrent = 0

      let release!: () => void
      const block = new Promise<void>((r) => {
        release = r
      })

      orchestrator.finalizeUpload.mockImplementation(async (job) => {
        inFlight++
        maxConcurrent = Math.max(maxConcurrent, inFlight)
        await block
        inFlight--
        return { kind: "finalized", uploadId: job.uploadId }
      })
      jobStore.markCompleted.mockResolvedValue(undefined)

      makeWorker({ concurrency: 2 })

      await worker!.start()
      await tick(2)

      expect(maxConcurrent).toBe(2)

      release()
      await tick(1)
    })

    it("stop() waits for in-flight jobs to finish", async () => {
      const job = makeJob()
      jobStore.listDue.mockResolvedValue([job])
      jobStore.tryClaim.mockResolvedValue(job)

      let release!: () => void
      const block = new Promise<void>((r) => {
        release = r
      })

      orchestrator.finalizeUpload.mockImplementation(async () => {
        await block
        return { kind: "finalized", uploadId: job.uploadId }
      })
      jobStore.markCompleted.mockResolvedValue(undefined)

      makeWorker({ drainPollMs: 10 as Milliseconds })

      await worker!.start()
      await tick(1)

      let stopResolved = false
      const stopPromise = worker!.stop().then(() => {
        stopResolved = true
      })

      await tick(50)
      expect(stopResolved).toBe(false)

      release()
      await tick(1)
      await stopPromise
      expect(stopResolved).toBe(true)
    })

    it("does not start new jobs after stop called", async () => {
      const job1 = makeJob()
      const job2 = makeJob()

      jobStore.listDue.mockResolvedValueOnce([job1]).mockResolvedValue([job2])
      jobStore.tryClaim.mockResolvedValue(job1)

      orchestrator.finalizeUpload.mockResolvedValue({
        kind: "finalized",
        uploadId: job1.uploadId,
      })
      jobStore.markCompleted.mockResolvedValue(undefined)

      makeWorker()

      await start()
      await stop()

      const calls = orchestrator.finalizeUpload.mock.calls.length
      await tick(200)

      expect(orchestrator.finalizeUpload.mock.calls.length).toBe(calls)
    })
  })

  describe("error recovery", () => {
    it("survives job store errors during polling and keeps running", async () => {
      jobStore.listDue
        .mockRejectedValueOnce(new Error("Connection reset"))
        .mockResolvedValue([])
      makeWorker()

      await worker!.start()
      await tick(1)

      await tick(30)
      expect(jobStore.listDue.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })
})
