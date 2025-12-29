import type { Milliseconds } from "@subspace/clock"
import { FakeClock } from "@subspace/clock"
import type { AttemptContext, RetryAttemptInfo } from "../../ports/attempt-context"
import type { DelayPolicy } from "../../ports/delay-policy"
import { createRetryExecutor } from "../retry-executor"

class TestClock extends FakeClock {
  sleepCalls: Array<{ ms: Milliseconds; signal?: AbortSignal }> = []
  private abortController: AbortController | null = null

  override async sleep(ms: Milliseconds, signal?: AbortSignal): Promise<void> {
    this.sleepCalls.push({ ms, ...(signal && { signal }) })

    if (this.abortController) {
      this.abortController.abort()
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError")
      }
    }

    this.advance(ms)
  }

  abortOnNextSleep(controller: AbortController): void {
    this.abortController = controller
  }

  reset(): void {
    this.set(0)
    this.sleepCalls = []
    this.abortController = null
  }
}

describe("createRetryExecutor", () => {
  let clock: TestClock
  let constantDelay: DelayPolicy

  beforeEach(() => {
    clock = new TestClock()
    constantDelay = { getDelay: () => ({ milliseconds: 100 }) }
  })

  describe("config validation", () => {
    it("throws RangeError for maxAttempts < 1", async () => {
      const executor = createRetryExecutor({ clock })

      await expect(
        executor.tryExecute(async () => "ok", {
          maxAttempts: 0.5,
          delay: constantDelay,
        }),
      ).rejects.toThrow(RangeError)
    })

    it("throws RangeError for maxAttempts = 0", async () => {
      const executor = createRetryExecutor({ clock })

      await expect(
        executor.tryExecute(async () => "ok", {
          maxAttempts: 0,
          delay: constantDelay,
        }),
      ).rejects.toThrow(RangeError)
    })

    it("throws RangeError for non-integer maxAttempts", async () => {
      const executor = createRetryExecutor({ clock })

      await expect(
        executor.tryExecute(async () => "ok", {
          maxAttempts: 2.5,
          delay: constantDelay,
        }),
      ).rejects.toThrow(RangeError)
    })

    it("throws RangeError for negative maxAttempts", async () => {
      const executor = createRetryExecutor({ clock })

      await expect(
        executor.tryExecute(async () => "ok", {
          maxAttempts: -1,
          delay: constantDelay,
        }),
      ).rejects.toThrow(RangeError)
    })

    it("throws RangeError for maxElapsedMs = NaN", async () => {
      const executor = createRetryExecutor({ clock })

      await expect(
        executor.tryExecute(async () => "ok", {
          maxAttempts: 3,
          delay: constantDelay,
          maxElapsedMs: NaN,
        }),
      ).rejects.toThrow(RangeError)
    })

    it("throws RangeError for maxElapsedMs = Infinity", async () => {
      const executor = createRetryExecutor({ clock })

      await expect(
        executor.tryExecute(async () => "ok", {
          maxAttempts: 3,
          delay: constantDelay,
          maxElapsedMs: Infinity,
        }),
      ).rejects.toThrow(RangeError)
    })

    it("throws RangeError for negative maxElapsedMs", async () => {
      const executor = createRetryExecutor({ clock })

      await expect(
        executor.tryExecute(async () => "ok", {
          maxAttempts: 3,
          delay: constantDelay,
          maxElapsedMs: -100,
        }),
      ).rejects.toThrow(RangeError)
    })

    it("accepts maxElapsedMs = 0", async () => {
      const executor = createRetryExecutor({ clock })

      const result = await executor.tryExecute(async () => "ok", {
        maxAttempts: 3,
        delay: constantDelay,
        maxElapsedMs: 0,
      })

      expect(result.elapsedMs).toBe(0)
    })

    it("accepts fractional maxElapsedMs", async () => {
      const executor = createRetryExecutor({ clock })

      const result = await executor.tryExecute(async () => "ok", {
        maxAttempts: 1,
        delay: constantDelay,
        maxElapsedMs: 100.5,
      })

      expect(result.success).toBe(true)
    })

    it("validates config even when signal is pre-aborted", async () => {
      const executor = createRetryExecutor({ clock })
      const controller = new AbortController()
      controller.abort()

      await expect(
        executor.tryExecute(async () => "ok", {
          maxAttempts: -1,
          delay: constantDelay,
          signal: controller.signal,
        }),
      ).rejects.toThrow(RangeError)
    })
  })

  describe("basic execute behavior", () => {
    describe("execute", () => {
      it("returns value on first attempt success", async () => {
        const executor = createRetryExecutor({ clock })

        const value = await executor.execute(async () => "success", {
          maxAttempts: 3,
          delay: constantDelay,
        })

        expect(value).toBe("success")
      })

      it("returns value after retries succeed", async () => {
        const executor = createRetryExecutor({ clock })
        let attempt = 0

        const value = await executor.execute(
          async () => {
            attempt++
            if (attempt < 3) throw new Error("fail")
            return "success"
          },
          { maxAttempts: 5, delay: constantDelay },
        )

        expect(value).toBe("success")
      })

      it("throws after exhausting all attempts", async () => {
        const executor = createRetryExecutor({ clock })

        await expect(
          executor.execute(
            async () => {
              throw new Error("always fails")
            },
            { maxAttempts: 3, delay: constantDelay },
          ),
        ).rejects.toThrow("always fails")
      })

      it("throws on abort", async () => {
        const executor = createRetryExecutor({ clock })
        const controller = new AbortController()
        controller.abort()

        await expect(
          executor.execute(async () => "ok", {
            maxAttempts: 3,
            delay: constantDelay,
            signal: controller.signal,
          }),
        ).rejects.toThrow("Aborted")
      })

      it("throws on timeout", async () => {
        const executor = createRetryExecutor({ clock })

        await expect(
          executor.execute(
            async () => {
              clock.advance(600)
              throw new Error("fail")
            },
            {
              maxAttempts: 3,
              delay: constantDelay,
              maxElapsedMs: 500,
            },
          ),
        ).rejects.toThrow("fail")
      })
    })

    describe("tryExecute", () => {
      it("returns value on first attempt success", async () => {
        const executor = createRetryExecutor({ clock })

        const result = await executor.tryExecute(async () => "success", {
          maxAttempts: 3,
          delay: constantDelay,
        })

        expect(result).toEqual({
          success: true,
          value: "success",
          attempts: 1,
          elapsedMs: 0,
        })
      })

      it("returns value after retries succeed", async () => {
        const executor = createRetryExecutor({ clock })
        let attempt = 0

        const result = await executor.tryExecute(
          async () => {
            attempt++
            if (attempt < 3) throw new Error("fail")
            return "success"
          },
          { maxAttempts: 5, delay: constantDelay },
        )

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.value).toBe("success")
          expect(result.attempts).toBe(3)
        }
      })

      it("execute throws after exhausting all attempts", async () => {
        const executor = createRetryExecutor({ clock })

        await expect(
          executor.execute(
            async () => {
              throw new Error("always fails")
            },
            { maxAttempts: 3, delay: constantDelay },
          ),
        ).rejects.toThrow("always fails")
      })

      it("tryExecute returns failure result when exhausted", async () => {
        const executor = createRetryExecutor({ clock })

        const result = await executor.tryExecute(
          async () => {
            throw new Error("always fails")
          },
          { maxAttempts: 3, delay: constantDelay },
        )

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBeInstanceOf(Error)
          expect((result.error as Error).message).toBe("always fails")
        }
      })

      it("tries exactly maxAttempts times before exhausting", async () => {
        const executor = createRetryExecutor({ clock })
        let attempts = 0

        await executor.tryExecute(
          async () => {
            attempts++
            throw new Error("fail")
          },
          { maxAttempts: 5, delay: constantDelay },
        )

        expect(attempts).toBe(5)
      })

      it("passes correct context to fn on each attempt", async () => {
        const executor = createRetryExecutor({ clock })
        const contexts: AttemptContext[] = []

        await executor.tryExecute(
          async (ctx) => {
            contexts.push({ ...ctx })
            if (ctx.attempt < 2) throw new Error("fail")
            return "ok"
          },
          { maxAttempts: 3, delay: constantDelay },
        )

        expect(contexts).toHaveLength(3)
        expect(contexts[0]!.attempt).toBe(0)
        expect(contexts[1]!.attempt).toBe(1)
        expect(contexts[2]!.attempt).toBe(2)
      })
    })
  })

  describe("delay policy", () => {
    it("calls delay.getDelay with attempt number", async () => {
      const executor = createRetryExecutor({ clock })
      const getDelayCalls: number[] = []
      const delay: DelayPolicy = {
        getDelay: (attempt) => {
          getDelayCalls.push(attempt)
          return { milliseconds: 100 }
        },
      }

      await executor.tryExecute(
        async (ctx) => {
          if (ctx.attempt < 2) throw new Error("fail")
          return "ok"
        },
        { maxAttempts: 3, delay },
      )

      expect(getDelayCalls).toEqual([0, 1])
    })

    it("sleeps for duration returned by policy", async () => {
      const executor = createRetryExecutor({ clock })
      const delay: DelayPolicy = {
        getDelay: (attempt) => ({ milliseconds: (attempt + 1) * 100 }),
      }

      await executor.tryExecute(
        async (ctx) => {
          if (ctx.attempt < 2) throw new Error("fail")
          return "ok"
        },
        { maxAttempts: 3, delay },
      )

      expect(clock.sleepCalls).toEqual([{ ms: 100 }, { ms: 200 }])
    })

    it("awaits sleep before next attempt", async () => {
      const executor = createRetryExecutor({ clock })
      const events: string[] = []

      const originalSleep = clock.sleep.bind(clock)
      clock.sleep = async (ms, signal) => {
        events.push("sleep-start")
        await originalSleep(ms, signal)
        events.push("sleep-end")
      }

      await executor.tryExecute(
        async (ctx) => {
          events.push(`attempt-${ctx.attempt}`)
          if (ctx.attempt < 1) throw new Error("fail")
          return "ok"
        },
        { maxAttempts: 2, delay: constantDelay },
      )

      expect(events).toEqual(["attempt-0", "sleep-start", "sleep-end", "attempt-1"])
    })

    it("does not call delay policy on first attempt success", async () => {
      const executor = createRetryExecutor({ clock })
      const getDelay = vi.fn(() => ({ milliseconds: 100 }))

      await executor.tryExecute(async () => "ok", {
        maxAttempts: 3,
        delay: { getDelay },
      })

      expect(getDelay).not.toHaveBeenCalled()
    })

    it("does not call delay policy after final attempt fails", async () => {
      const executor = createRetryExecutor({ clock })
      const getDelayCalls: number[] = []
      const delay: DelayPolicy = {
        getDelay: (attempt) => {
          getDelayCalls.push(attempt)
          return { milliseconds: 100 }
        },
      }

      await executor.tryExecute(
        async () => {
          throw new Error("fail")
        },
        { maxAttempts: 3, delay },
      )

      expect(getDelayCalls).toEqual([0, 1])
    })

    it("does not call delay policy when predicate stops retry", async () => {
      const executor = createRetryExecutor({ clock })
      const getDelay = vi.fn(() => ({ milliseconds: 100 }))

      await executor.tryExecute(
        async () => {
          throw new Error("fail")
        },
        {
          maxAttempts: 3,
          delay: { getDelay },
          errorPredicate: { shouldRetry: () => false },
        },
      )

      expect(getDelay).not.toHaveBeenCalled()
    })

    it("skips sleep when delay is 0", async () => {
      const executor = createRetryExecutor({ clock })

      await executor.tryExecute(
        async (ctx) => {
          if (ctx.attempt < 1) throw new Error("fail")
          return "ok"
        },
        {
          maxAttempts: 2,
          delay: { getDelay: () => ({ milliseconds: 0 }) },
        },
      )

      expect(clock.sleepCalls).toHaveLength(0)
    })

    it("execute throws the error from failed result", async () => {
      const executor = createRetryExecutor({ clock })

      const error = await executor
        .execute(
          async () => {
            throw new Error("execution failed")
          },
          { maxAttempts: 1, delay: constantDelay },
        )
        .catch((e) => e)

      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe("execution failed")
    })
  })

  describe("errorPredicate", () => {
    it("retries when predicate returns true", async () => {
      const executor = createRetryExecutor({ clock })
      let attempts = 0

      await executor.tryExecute(
        async () => {
          attempts++
          throw new Error("fail")
        },
        {
          maxAttempts: 3,
          delay: constantDelay,
          errorPredicate: { shouldRetry: () => true },
        },
      )

      expect(attempts).toBe(3)
    })

    it("stops retry when predicate returns false", async () => {
      const executor = createRetryExecutor({ clock })
      let attempts = 0

      await executor.tryExecute(
        async () => {
          attempts++
          throw new Error("fail")
        },
        {
          maxAttempts: 3,
          delay: constantDelay,
          errorPredicate: { shouldRetry: () => false },
        },
      )

      expect(attempts).toBe(1)
    })

    it("receives error and context", async () => {
      const executor = createRetryExecutor({ clock })
      const calls: Array<{ error: unknown; ctx: AttemptContext }> = []

      await executor.tryExecute(
        async () => {
          throw new Error("test error")
        },
        {
          maxAttempts: 2,
          delay: constantDelay,
          errorPredicate: {
            shouldRetry: (error, ctx) => {
              calls.push({ error, ctx: { ...ctx } })
              return true
            },
          },
        },
      )

      expect(calls).toHaveLength(2)
      expect((calls[0]!.error as Error).message).toBe("test error")
      expect(calls[0]!.ctx.attempt).toBe(0)
      expect(calls[1]!.ctx.attempt).toBe(1)
    })

    it("defaults to always retry", async () => {
      const executor = createRetryExecutor({ clock })
      let attempts = 0

      await executor.tryExecute(
        async () => {
          attempts++
          throw new Error("fail")
        },
        { maxAttempts: 3, delay: constantDelay },
      )

      expect(attempts).toBe(3)
    })

    it("does not retry on last attempt even if predicate returns true", async () => {
      const executor = createRetryExecutor({ clock })
      let attempts = 0
      let predicateCalls = 0

      await executor.tryExecute(
        async () => {
          attempts++
          throw new Error("fail")
        },
        {
          maxAttempts: 2,
          delay: constantDelay,
          errorPredicate: {
            shouldRetry: () => {
              predicateCalls++
              return true
            },
          },
        },
      )

      expect(attempts).toBe(2)
      expect(predicateCalls).toBe(2)
      expect(clock.sleepCalls).toHaveLength(1)
    })
  })

  describe("resultPredicate", () => {
    it("retries when predicate returns true", async () => {
      const executor = createRetryExecutor({ clock })
      let attempts = 0

      await executor.tryExecute(
        async () => {
          attempts++
          return { status: attempts < 3 ? "pending" : "done" }
        },
        {
          maxAttempts: 5,
          delay: constantDelay,
          resultPredicate: {
            shouldRetry: (result) => result.status === "pending",
          },
        },
      )

      expect(attempts).toBe(3)
    })

    it("accepts result when predicate returns false", async () => {
      const executor = createRetryExecutor({ clock })

      const result = await executor.tryExecute(async () => ({ value: 42 }), {
        maxAttempts: 3,
        delay: constantDelay,
        resultPredicate: { shouldRetry: () => false },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual({ value: 42 })
      }
    })

    it("receives result and context", async () => {
      const executor = createRetryExecutor({ clock })
      const calls: Array<{ result: unknown; ctx: AttemptContext }> = []

      await executor.tryExecute(async (ctx) => ({ attempt: ctx.attempt }), {
        maxAttempts: 2,
        delay: constantDelay,
        resultPredicate: {
          shouldRetry: (result, ctx) => {
            calls.push({ result, ctx: { ...ctx } })
            return ctx.attempt < 1
          },
        },
      })

      expect(calls).toHaveLength(2)
      expect(calls[0]!.result).toEqual({ attempt: 0 })
      expect(calls[0]!.ctx.attempt).toBe(0)
    })

    it("defaults to accept all results", async () => {
      const executor = createRetryExecutor({ clock })
      let attempts = 0

      const result = await executor.tryExecute(
        async () => {
          attempts++
          return "ok"
        },
        { maxAttempts: 3, delay: constantDelay },
      )

      expect(attempts).toBe(1)
      expect(result.success).toBe(true)
    })

    it("does not retry on last attempt even if predicate returns true", async () => {
      const executor = createRetryExecutor({ clock })
      let attempts = 0

      const result = await executor.tryExecute(
        async () => {
          attempts++
          return "pending"
        },
        {
          maxAttempts: 2,
          delay: constantDelay,
          resultPredicate: { shouldRetry: () => true },
        },
      )

      expect(attempts).toBe(2)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe("pending")
      }
    })
  })

  describe("abort signal", () => {
    it("pre-aborted signal returns immediately with attempts: 0", async () => {
      const executor = createRetryExecutor({ clock })
      const controller = new AbortController()
      controller.abort()

      const result = await executor.tryExecute(async () => "ok", {
        maxAttempts: 3,
        delay: constantDelay,
        signal: controller.signal,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.attempts).toBe(0)
        expect(result.aborted).toBe(true)
      }
    })

    it("pre-aborted signal does not call fn", async () => {
      const executor = createRetryExecutor({ clock })
      const controller = new AbortController()
      controller.abort()
      const fn = vi.fn(async () => "ok")

      await executor.tryExecute(fn, {
        maxAttempts: 3,
        delay: constantDelay,
        signal: controller.signal,
      })

      expect(fn).not.toHaveBeenCalled()
    })

    it("abort during attempt stops retry after current attempt", async () => {
      const executor = createRetryExecutor({ clock })
      const controller = new AbortController()
      let attempts = 0

      const result = await executor.tryExecute(
        async () => {
          attempts++
          if (attempts === 2) controller.abort()
          throw new Error("fail")
        },
        {
          maxAttempts: 5,
          delay: constantDelay,
          signal: controller.signal,
        },
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.aborted).toBe(true)
        expect(result.attempts).toBe(2)
      }
    })

    it("abort during sleep stops retry", async () => {
      const executor = createRetryExecutor({ clock })
      const controller = new AbortController()
      let attempts = 0

      clock.abortOnNextSleep(controller)

      const result = await executor.tryExecute(
        async () => {
          attempts++
          throw new Error("fail")
        },
        {
          maxAttempts: 5,
          delay: constantDelay,
          signal: controller.signal,
        },
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.aborted).toBe(true)
        expect(attempts).toBe(1)
      }
    })

    it("passes signal to clock.sleep", async () => {
      const executor = createRetryExecutor({ clock })
      const controller = new AbortController()

      await executor.tryExecute(
        async (ctx) => {
          if (ctx.attempt < 1) throw new Error("fail")
          return "ok"
        },
        {
          maxAttempts: 3,
          delay: constantDelay,
          signal: controller.signal,
        },
      )

      expect(clock.sleepCalls[0]!.signal).toBe(controller.signal)
    })

    it("returns success if abort happens after success", async () => {
      const executor = createRetryExecutor({ clock })
      const controller = new AbortController()

      const result = await executor.tryExecute(
        async () => {
          const value = "ok"
          controller.abort()
          return value
        },
        {
          maxAttempts: 3,
          delay: constantDelay,
          signal: controller.signal,
        },
      )

      expect(result.success).toBe(true)
    })

    it("abort during sleep after result retry stops retry", async () => {
      const executor = createRetryExecutor({ clock })
      const controller = new AbortController()
      let attempts = 0

      clock.abortOnNextSleep(controller)

      const result = await executor.tryExecute(
        async () => {
          attempts++
          return { status: "pending" }
        },
        {
          maxAttempts: 5,
          delay: constantDelay,
          resultPredicate: { shouldRetry: (r) => r.status === "pending" },
          signal: controller.signal,
        },
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.aborted).toBe(true)
        expect(attempts).toBe(1)
      }
    })
  })

  describe("maxElapsedMs timeout", () => {
    it("times out after fn exceeds elapsed time", async () => {
      const executor = createRetryExecutor({ clock })

      const result = await executor.tryExecute(
        async () => {
          clock.advance(600)
          throw new Error("fail")
        },
        {
          maxAttempts: 3,
          delay: constantDelay,
          maxElapsedMs: 500,
        },
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.timedOut).toBe(true)
        expect(result.attempts).toBe(1)
      }
    })

    it("times out between attempts when elapsed exceeds max", async () => {
      const executor = createRetryExecutor({ clock })

      const result = await executor.tryExecute(
        async (ctx) => {
          if (ctx.attempt === 0) clock.advance(400)
          throw new Error("fail")
        },
        {
          maxAttempts: 5,
          delay: { getDelay: () => ({ milliseconds: 200 }) },
          maxElapsedMs: 500,
        },
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.timedOut).toBe(true)
        expect(result.attempts).toBe(1)
      }
    })

    it("clamps sleep duration to remaining time", async () => {
      const executor = createRetryExecutor({ clock })

      await executor.tryExecute(
        async (ctx) => {
          if (ctx.attempt === 0) {
            clock.advance(150)
            throw new Error("fail")
          }
          return "ok"
        },
        {
          maxAttempts: 3,
          delay: { getDelay: () => ({ milliseconds: 100 }) },
          maxElapsedMs: 200,
        },
      )

      expect(clock.sleepCalls[0]!.ms).toBe(50)
    })

    it("includes last error in timeout result", async () => {
      const executor = createRetryExecutor({ clock })

      const result = await executor.tryExecute(
        async () => {
          clock.advance(600)
          throw new Error("specific error")
        },
        {
          maxAttempts: 5,
          delay: constantDelay,
          maxElapsedMs: 500,
        },
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.timedOut).toBe(true)
        expect((result.error as Error).message).toBe("specific error")
      }
    })

    it("returns timedOut: true, aborted: false", async () => {
      const executor = createRetryExecutor({ clock })

      const result = await executor.tryExecute(
        async () => {
          clock.advance(600)
          throw new Error("fail")
        },
        {
          maxAttempts: 3,
          delay: constantDelay,
          maxElapsedMs: 500,
        },
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.timedOut).toBe(true)
        expect(result.aborted).toBe(false)
      }
    })
  })

  describe("attempt counting", () => {
    it("pre-abort returns attempts: 0", async () => {
      const executor = createRetryExecutor({ clock })
      const controller = new AbortController()
      controller.abort()

      const result = await executor.tryExecute(async () => "ok", {
        maxAttempts: 3,
        delay: constantDelay,
        signal: controller.signal,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.attempts).toBe(0)
      }
    })

    it("abort during attempt N returns attempts: N", async () => {
      const executor = createRetryExecutor({ clock })
      const controller = new AbortController()

      const result = await executor.tryExecute(
        async (ctx) => {
          if (ctx.attempt === 1) controller.abort()
          throw new Error("fail")
        },
        {
          maxAttempts: 5,
          delay: constantDelay,
          signal: controller.signal,
        },
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.attempts).toBe(2)
      }
    })

    it("timeout after attempt N returns attempts: N", async () => {
      const executor = createRetryExecutor({ clock })

      const result = await executor.tryExecute(
        async (ctx) => {
          clock.advance(100)
          if (ctx.attempt === 1) clock.advance(500)
          throw new Error("fail")
        },
        {
          maxAttempts: 5,
          delay: constantDelay,
          maxElapsedMs: 500,
        },
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.timedOut).toBe(true)
        expect(result.attempts).toBe(2)
      }
    })

    it("exhaustion after N attempts returns attempts: N", async () => {
      const executor = createRetryExecutor({ clock })

      const result = await executor.tryExecute(
        async () => {
          throw new Error("fail")
        },
        { maxAttempts: 4, delay: constantDelay },
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.attempts).toBe(4)
      }
    })

    it("success on attempt N returns attempts: N", async () => {
      const executor = createRetryExecutor({ clock })
      let attempt = 0

      const result = await executor.tryExecute(
        async () => {
          attempt++
          if (attempt < 3) throw new Error("fail")
          return "ok"
        },
        { maxAttempts: 5, delay: constantDelay },
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.attempts).toBe(3)
      }
    })
  })

  describe("context and attemptInfo correctness", () => {
    it("attempt is 0-indexed", async () => {
      const executor = createRetryExecutor({ clock })
      const attempts: number[] = []

      await executor.tryExecute(
        async (ctx) => {
          attempts.push(ctx.attempt)
          if (ctx.attempt < 2) throw new Error("fail")
          return "ok"
        },
        { maxAttempts: 3, delay: constantDelay },
      )

      expect(attempts).toEqual([0, 1, 2])
    })

    it("attemptsSoFar equals attempt + 1", async () => {
      const executor = createRetryExecutor({ clock })
      const contexts: AttemptContext[] = []

      await executor.tryExecute(
        async (ctx) => {
          contexts.push({ ...ctx })
          if (ctx.attempt < 2) throw new Error("fail")
          return "ok"
        },
        { maxAttempts: 3, delay: constantDelay },
      )

      contexts.forEach((ctx) => {
        expect(ctx.attemptsSoFar).toBe(ctx.attempt + 1)
      })
    })

    it("startedAt is consistent across attempts", async () => {
      const executor = createRetryExecutor({ clock })
      clock.set(5000)
      const startedAts: number[] = []

      await executor.tryExecute(
        async (ctx) => {
          startedAts.push(ctx.startedAt)
          if (ctx.attempt < 2) throw new Error("fail")
          return "ok"
        },
        { maxAttempts: 3, delay: constantDelay },
      )

      expect(startedAts).toEqual([5000, 5000, 5000])
    })

    it("elapsedMs increases across attempts", async () => {
      const executor = createRetryExecutor({ clock })
      const elapsedValues: number[] = []

      await executor.tryExecute(
        async (ctx) => {
          elapsedValues.push(ctx.elapsedMs)
          if (ctx.attempt < 2) throw new Error("fail")
          return "ok"
        },
        { maxAttempts: 3, delay: constantDelay },
      )

      expect(elapsedValues[0]).toBe(0)
      expect(elapsedValues[1]).toBe(100)
      expect(elapsedValues[2]).toBe(200)
    })

    it("signal is present in context when provided", async () => {
      const executor = createRetryExecutor({ clock })
      const controller = new AbortController()
      let receivedSignal: AbortSignal | undefined

      await executor.tryExecute(
        async (ctx) => {
          receivedSignal = ctx.signal
          return "ok"
        },
        {
          maxAttempts: 1,
          delay: constantDelay,
          signal: controller.signal,
        },
      )

      expect(receivedSignal).toBe(controller.signal)
    })

    it("nextDelayMs matches delay policy", async () => {
      const executor = createRetryExecutor({ clock })
      const infos: RetryAttemptInfo[] = []
      const delay: DelayPolicy = {
        getDelay: (attempt) => ({ milliseconds: (attempt + 1) * 50 }),
      }

      await executor.tryExecute(
        async () => {
          throw new Error("fail")
        },
        {
          maxAttempts: 3,
          delay,
          observer: {
            onError: async (_error, info) => {
              infos.push({ ...info })
            },
          },
        },
      )

      expect(infos[0]!.nextDelayMs).toBe(50)
      expect(infos[1]!.nextDelayMs).toBe(100)
    })

    it("nextDelayMs is null on final attempt", async () => {
      const executor = createRetryExecutor({ clock })
      let finalInfo: RetryAttemptInfo | undefined

      await executor.tryExecute(
        async () => {
          throw new Error("fail")
        },
        {
          maxAttempts: 2,
          delay: constantDelay,
          observer: {
            onExhausted: async (_error, info) => {
              finalInfo = { ...info }
            },
          },
        },
      )

      expect(finalInfo?.nextDelayMs).toBeNull()
    })

    it("isLastAttempt is true only on final attempt", async () => {
      const executor = createRetryExecutor({ clock })
      const isLastAttemptValues: boolean[] = []

      await executor.tryExecute(
        async () => {
          throw new Error("fail")
        },
        {
          maxAttempts: 3,
          delay: constantDelay,
          observer: {
            onError: async (_error, info) => {
              isLastAttemptValues.push(info.isLastAttempt)
            },
            onExhausted: async (_error, info) => {
              isLastAttemptValues.push(info.isLastAttempt)
            },
          },
        },
      )

      expect(isLastAttemptValues).toEqual([false, false, true])
    })
  })

  describe("observer callbacks", () => {
    it("onAttempt called before fn, in order", async () => {
      const executor = createRetryExecutor({ clock })
      const events: string[] = []

      await executor.tryExecute(
        async (ctx) => {
          events.push(`fn-${ctx.attempt}`)
          if (ctx.attempt < 1) throw new Error("fail")
          return "ok"
        },
        {
          maxAttempts: 2,
          delay: constantDelay,
          observer: {
            onAttempt: async (ctx) => {
              events.push(`onAttempt-${ctx.attempt}`)
            },
          },
        },
      )

      expect(events).toEqual(["onAttempt-0", "fn-0", "onAttempt-1", "fn-1"])
    })

    it("onSuccess called once on success, is terminal", async () => {
      const executor = createRetryExecutor({ clock })
      let successCalls = 0
      let successValue: unknown

      await executor.tryExecute(
        async (ctx) => {
          if (ctx.attempt < 1) throw new Error("fail")
          return "final value"
        },
        {
          maxAttempts: 3,
          delay: constantDelay,
          observer: {
            onSuccess: async (result) => {
              successCalls++
              successValue = result
            },
          },
        },
      )

      expect(successCalls).toBe(1)
      expect(successValue).toBe("final value")
    })

    it("onError called before sleep, includes nextDelayMs", async () => {
      const executor = createRetryExecutor({ clock })
      const events: string[] = []

      const originalSleep = clock.sleep.bind(clock)
      clock.sleep = async (ms, signal) => {
        events.push("sleep")
        await originalSleep(ms, signal)
      }

      await executor.tryExecute(
        async () => {
          throw new Error("fail")
        },
        {
          maxAttempts: 2,
          delay: constantDelay,
          observer: {
            onError: async (_error, info) => {
              events.push(`onError-delay-${info.nextDelayMs}`)
            },
          },
        },
      )

      expect(events).toEqual(["onError-delay-100", "sleep"])
    })

    it("onExhausted called once on exhaustion, is terminal", async () => {
      const executor = createRetryExecutor({ clock })
      let exhaustedCalls = 0
      let exhaustedError: unknown

      await executor.tryExecute(
        async () => {
          throw new Error("final error")
        },
        {
          maxAttempts: 3,
          delay: constantDelay,
          observer: {
            onExhausted: async (error) => {
              exhaustedCalls++
              exhaustedError = error
            },
          },
        },
      )

      expect(exhaustedCalls).toBe(1)
      expect((exhaustedError as Error).message).toBe("final error")
    })

    it("onExhausted called on timeout", async () => {
      const executor = createRetryExecutor({ clock })
      let exhaustedCalled = false

      await executor.tryExecute(
        async () => {
          clock.advance(600)
          throw new Error("fail")
        },
        {
          maxAttempts: 5,
          delay: constantDelay,
          maxElapsedMs: 500,
          observer: {
            onExhausted: async () => {
              exhaustedCalled = true
            },
          },
        },
      )

      expect(exhaustedCalled).toBe(true)
    })

    it("onAborted called on abort", async () => {
      const executor = createRetryExecutor({ clock })
      const controller = new AbortController()
      controller.abort()
      let abortedCalled = false

      await executor.tryExecute(async () => "ok", {
        maxAttempts: 3,
        delay: constantDelay,
        signal: controller.signal,
        observer: {
          onAborted: async () => {
            abortedCalled = true
          },
        },
      })

      expect(abortedCalled).toBe(true)
    })

    it("onResultRetry called when result triggers retry", async () => {
      const executor = createRetryExecutor({ clock })
      const resultRetryCalls: Array<{ result: unknown; attempt: number }> = []

      await executor.tryExecute(
        async (ctx) => ({ status: ctx.attempt < 2 ? "pending" : "done" }),
        {
          maxAttempts: 5,
          delay: constantDelay,
          resultPredicate: {
            shouldRetry: (result) => result.status === "pending",
          },
          observer: {
            onResultRetry: async (result, info) => {
              resultRetryCalls.push({ result, attempt: info.attempt })
            },
          },
        },
      )

      expect(resultRetryCalls).toEqual([
        { result: { status: "pending" }, attempt: 0 },
        { result: { status: "pending" }, attempt: 1 },
      ])
    })

    it("observer errors propagate from execute", async () => {
      const executor = createRetryExecutor({ clock })

      await expect(
        executor.execute(async () => "ok", {
          maxAttempts: 1,
          delay: constantDelay,
          observer: {
            onSuccess: async () => {
              throw new Error("observer error")
            },
          },
        }),
      ).rejects.toThrow("observer error")
    })

    it("observer errors propagate from tryExecute", async () => {
      const executor = createRetryExecutor({ clock })

      await expect(
        executor.tryExecute(async () => "ok", {
          maxAttempts: 1,
          delay: constantDelay,
          observer: {
            onSuccess: async () => {
              throw new Error("observer error")
            },
          },
        }),
      ).rejects.toThrow("observer error")
    })
  })

  describe("result shape", () => {
    it("success result has value and no error fields", async () => {
      const executor = createRetryExecutor({ clock })

      const result = await executor.tryExecute(async () => ({ data: 42 }), {
        maxAttempts: 1,
        delay: constantDelay,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual({ data: 42 })
        expect(result.attempts).toBe(1)
        expect(result.elapsedMs).toBe(0)
        expect("error" in result).toBe(false)
        expect("aborted" in result).toBe(false)
        expect("timedOut" in result).toBe(false)
      }
    })

    it("failure result has error and status flags", async () => {
      const executor = createRetryExecutor({ clock })

      const result = await executor.tryExecute(
        async () => {
          throw new Error("fail")
        },
        { maxAttempts: 1, delay: constantDelay },
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Error)
        expect(result.attempts).toBe(1)
        expect(result.elapsedMs).toBe(0)
        expect(result.aborted).toBe(false)
        expect(result.timedOut).toBe(false)
        expect("value" in result).toBe(false)
      }
    })
  })

  describe("edge cases", () => {
    it("handles fn returning undefined", async () => {
      const executor = createRetryExecutor({ clock })

      const result = await executor.tryExecute(async () => undefined, {
        maxAttempts: 1,
        delay: constantDelay,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBeUndefined()
      }
    })

    it("handles fn returning null", async () => {
      const executor = createRetryExecutor({ clock })

      const result = await executor.tryExecute(async () => null, {
        maxAttempts: 1,
        delay: constantDelay,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBeNull()
      }
    })

    it("handles fn throwing non-Error value", async () => {
      const executor = createRetryExecutor({ clock })

      const result = await executor.tryExecute(
        async () => {
          throw "string error"
        },
        { maxAttempts: 1, delay: constantDelay },
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe("string error")
      }
    })

    it("executor can be reused for multiple calls", async () => {
      const executor = createRetryExecutor({ clock })

      const result1 = await executor.tryExecute(async () => "first", {
        maxAttempts: 1,
        delay: constantDelay,
      })

      const result2 = await executor.tryExecute(async () => "second", {
        maxAttempts: 1,
        delay: constantDelay,
      })

      expect(result1.success).toBe(true)
      if (result1.success) expect(result1.value).toBe("first")

      expect(result2.success).toBe(true)
      if (result2.success) expect(result2.value).toBe("second")
    })

    it("concurrent executions are independent", async () => {
      const executor = createRetryExecutor({ clock })
      let call1Attempts = 0
      let call2Attempts = 0

      const [result1, result2] = await Promise.all([
        executor.tryExecute(
          async () => {
            call1Attempts++
            if (call1Attempts < 2) throw new Error("fail1")
            return "first"
          },
          { maxAttempts: 3, delay: constantDelay },
        ),
        executor.tryExecute(
          async () => {
            call2Attempts++
            if (call2Attempts < 3) throw new Error("fail2")
            return "second"
          },
          { maxAttempts: 5, delay: constantDelay },
        ),
      ])

      expect(result1.success).toBe(true)
      if (result1.success) expect(result1.value).toBe("first")

      expect(result2.success).toBe(true)
      if (result2.success) expect(result2.value).toBe("second")

      expect(call1Attempts).toBe(2)
      expect(call2Attempts).toBe(3)
    })
  })

  describe("integration", () => {
    it("exponential backoff with timeout", async () => {
      const executor = createRetryExecutor({ clock })
      const exponentialDelay: DelayPolicy = {
        getDelay: (attempt) => ({ milliseconds: 100 * 2 ** attempt }),
      }

      const result = await executor.tryExecute(
        async () => {
          throw new Error("fail")
        },
        {
          maxAttempts: 10,
          delay: exponentialDelay,
          maxElapsedMs: 1000,
        },
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.timedOut).toBe(true)
        expect(result.elapsedMs).toBeLessThanOrEqual(1000)
      }
    })

    it("result-based polling with abort", async () => {
      const executor = createRetryExecutor({ clock })
      const controller = new AbortController()
      let pollCount = 0

      const result = await executor.tryExecute(
        async () => {
          pollCount++
          if (pollCount === 3) controller.abort()
          return { ready: false }
        },
        {
          maxAttempts: 10,
          delay: constantDelay,
          resultPredicate: { shouldRetry: (r) => !r.ready },
          signal: controller.signal,
        },
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.aborted).toBe(true)
        expect(pollCount).toBe(3)
      }
    })

    it("abort takes precedence over timeout when both triggered", async () => {
      const executor = createRetryExecutor({ clock })
      const controller = new AbortController()
      controller.abort()

      const result = await executor.tryExecute(
        async () => {
          clock.advance(600)
          return "ok"
        },
        {
          maxAttempts: 3,
          delay: constantDelay,
          maxElapsedMs: 500,
          signal: controller.signal,
        },
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.aborted).toBe(true)
        expect(result.timedOut).toBe(false)
      }
    })

    it("observer tracking full retry sequence", async () => {
      const executor = createRetryExecutor({ clock })
      const events: string[] = []

      await executor.tryExecute(
        async (ctx) => {
          if (ctx.attempt < 2) throw new Error(`error-${ctx.attempt}`)
          return "done"
        },
        {
          maxAttempts: 3,
          delay: constantDelay,
          observer: {
            onAttempt: async (ctx) => {
              events.push(`attempt:${ctx.attempt}`)
            },
            onError: async (error, info) => {
              events.push(`error:${(error as Error).message}:delay=${info.nextDelayMs}`)
            },
            onSuccess: async (result, ctx) => {
              events.push(`success:${result}:attempt=${ctx.attempt}`)
            },
          },
        },
      )

      expect(events).toEqual([
        "attempt:0",
        "error:error-0:delay=100",
        "attempt:1",
        "error:error-1:delay=100",
        "attempt:2",
        "success:done:attempt=2",
      ])
    })
  })
})
