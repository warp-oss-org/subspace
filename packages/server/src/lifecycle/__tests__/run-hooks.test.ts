import { FakeClock } from "@subspace/clock"
import type { Logger } from "@subspace/logger"
import { mock } from "vitest-mock-extended"
import type { Mock } from "../../tests/mock"
import { sleep } from "../../tests/sleep"
import type { LifecycleHook } from "../lifecycle-hook"
import { runHooks } from "../run-hooks"

describe("runHooks", () => {
  let logger: Mock<Logger>

  beforeEach(() => {
    logger = mock<Logger>()
  })

  describe("happy path", () => {
    it("runs all hooks when they succeed", async () => {
      const order: string[] = []

      const hooks: LifecycleHook[] = [
        { name: "a", fn: async () => void order.push("a") },
        { name: "b", fn: async () => void order.push("b") },
        { name: "c", fn: async () => void order.push("c") },
      ]

      const clock = new FakeClock(0)

      await runHooks({ phase: "startup", clock, logger, deadlineMs: 1_000_000 }, hooks)

      expect(order).toStrictEqual(["a", "b", "c"])
    })

    it("returns no failures and timedOut=false when all hooks succeed", async () => {
      const hooks: LifecycleHook[] = [
        { name: "a", fn: async () => {} },
        { name: "b", fn: async () => {} },
      ]

      const clock = new FakeClock(0)

      const res = await runHooks(
        { phase: "startup", clock, logger, deadlineMs: 1_000_000 },
        hooks,
      )

      expect(res).toStrictEqual({ failures: [], timedOut: false })
    })
  })

  describe("failures", () => {
    it("collects failures and continues when failFast is false", async () => {
      const order: string[] = []

      const hooks: LifecycleHook[] = [
        {
          name: "bad",
          fn: async () => {
            order.push("bad")
            throw new Error("boom")
          },
        },
        { name: "good", fn: async () => void order.push("good") },
      ]

      const clock = new FakeClock(0)

      const res = await runHooks(
        { phase: "shutdown", clock, logger, deadlineMs: 1_000_000 },
        hooks,
        { failFast: false },
      )

      expect(order).toStrictEqual(["bad", "good"])
      expect(res).toStrictEqual({
        timedOut: false,
        failures: [expect.objectContaining({ hook: "bad", error: expect.any(Error) })],
      })
    })

    it("stops after first failure when failFast is true", async () => {
      const order: string[] = []

      const hooks: LifecycleHook[] = [
        {
          name: "bad",
          fn: async () => {
            order.push("bad")
            throw new Error("boom")
          },
        },
        { name: "good", fn: async () => void order.push("good") },
      ]

      const clock = new FakeClock(0)

      const res = await runHooks(
        { phase: "startup", clock, logger, deadlineMs: 1_000_000 },
        hooks,
        { failFast: true },
      )

      expect(order).toStrictEqual(["bad"])
      expect(res).toStrictEqual({
        timedOut: false,
        failures: [expect.objectContaining({ hook: "bad", error: expect.any(Error) })],
      })
    })

    it("returns timedOut=false when a hook fails but deadline is not exceeded", async () => {
      const hooks: LifecycleHook[] = [
        {
          name: "bad",
          fn: async () => {
            throw new Error("boom")
          },
        },
      ]

      const clock = new FakeClock(0)

      const res = await runHooks(
        { phase: "startup", clock, logger, deadlineMs: 10_000 },
        hooks,
        { failFast: true },
      )

      expect(res).toStrictEqual({
        timedOut: false,
        failures: [expect.objectContaining({ hook: "bad", error: expect.any(Error) })],
      })
    })
  })

  describe("timeouts", () => {
    it("returns timedOut=true when the deadline is already exceeded before starting", async () => {
      const ran = vi.fn(async () => {})

      const hooks: LifecycleHook[] = [{ name: "a", fn: ran }]

      const clock = new FakeClock(100)

      const res = await runHooks(
        { phase: "startup", clock, logger, deadlineMs: 100 },
        hooks,
      )

      expect(ran).not.toHaveBeenCalled()
      expect(res).toStrictEqual({
        timedOut: true,
        failures: [],
      })
    })

    it("returns timedOut=true when the deadline is exceeded after a hook completes", async () => {
      const clock = new FakeClock(0)

      const hooks: LifecycleHook[] = [
        {
          name: "a",
          fn: async () => {
            clock.advance(100)
          },
        },
      ]

      const res = await runHooks(
        { phase: "shutdown", clock, logger, deadlineMs: 50 },
        hooks,
      )

      expect(res.timedOut).toBe(true)
    })

    it("returns timedOut=true when a hook times out mid-execution", async () => {
      let observedAbort = false

      const hooks: LifecycleHook[] = [
        {
          name: "slow",
          fn: async ({ signal }) => {
            await new Promise<void>((resolve) => {
              signal.addEventListener(
                "abort",
                () => {
                  observedAbort = true
                  resolve()
                },
                { once: true },
              )
            })
          },
        },
      ]

      const clock = new FakeClock(0)

      const res = await runHooks(
        { phase: "startup", clock, logger, deadlineMs: 5 },
        hooks,
      )

      expect(observedAbort).toBe(true)
      expect(res.timedOut).toBe(true)
    })

    it("when failFast is true and a failing hook also times out, returns timedOut=true", async () => {
      const hooks: LifecycleHook[] = [
        {
          name: "bad",
          fn: async ({ signal }) => {
            await new Promise<void>((resolve) => {
              signal.addEventListener("abort", () => resolve(), { once: true })
            })
            throw new Error("boom")
          },
        },
        { name: "never", fn: async () => {} },
      ]

      const clock = new FakeClock(0)

      const res = await runHooks(
        { phase: "startup", clock, logger, deadlineMs: 5 },
        hooks,
        { failFast: true },
      )

      expect(res).toStrictEqual({
        timedOut: true,
        failures: [expect.objectContaining({ hook: "bad", error: expect.any(Error) })],
      })
    })
  })

  describe("phase awareness", () => {
    it.each([
      "startup",
      "shutdown",
    ] as const)("uses phase='%s' in log messages", async (phase) => {
      const hooks: LifecycleHook[] = [{ name: "a", fn: async () => {} }]

      const clock = new FakeClock(0)

      await runHooks({ phase, clock, logger, deadlineMs: 10_000 }, hooks)

      expect(logger.info).toHaveBeenCalledWith(`Executed ${phase} hook: a`)
    })

    it.each([
      "startup",
      "shutdown",
    ] as const)("warns about skipping remaining hooks due to timeout for phase='%s'", async (phase) => {
      const hooks: LifecycleHook[] = [{ name: "a", fn: async () => {} }]

      const clock = new FakeClock(10)

      const res = await runHooks({ phase, clock, logger, deadlineMs: 10 }, hooks)

      expect(res.timedOut).toBe(true)
      expect(logger.warn).toHaveBeenCalledWith(
        `Skipping remaining ${phase} hooks due to timeout`,
      )
    })
  })

  describe("hook contract", () => {
    it("passes a signal and timeRemainingMs into hook.fn", async () => {
      const hookFn = vi.fn(async (_args: any) => {})

      const hooks: LifecycleHook[] = [{ name: "a", fn: hookFn }]

      const clock = new FakeClock(0)

      await runHooks({ phase: "startup", clock, logger, deadlineMs: 50 }, hooks)

      expect(hookFn).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          timeRemainingMs: 50,
        }),
      )
    })

    it("hook observes signal.aborted when timeout fires mid-execution", async () => {
      const hookFn = vi.fn(async ({ signal }: any) => {
        await new Promise<void>((resolve) => {
          signal.addEventListener("abort", () => resolve(), { once: true })
        })
        return signal.aborted
      })

      const hooks: LifecycleHook[] = [{ name: "a", fn: hookFn }]

      const clock = new FakeClock(0)

      await runHooks({ phase: "startup", clock, logger, deadlineMs: 5 }, hooks)

      expect(hookFn).toHaveBeenCalledOnce()
      await expect(hookFn.mock.results[0]?.value).resolves.toBe(true)
    })
  })

  describe("ordering", () => {
    it("executes hooks in the order provided", async () => {
      const order: string[] = []

      const hooks: LifecycleHook[] = [
        { name: "a", fn: async () => void order.push("a") },
        { name: "b", fn: async () => void order.push("b") },
      ]

      const clock = new FakeClock(0)

      await runHooks({ phase: "shutdown", clock, logger, deadlineMs: 1_000_000 }, hooks)

      expect(order).toStrictEqual(["a", "b"])
    })

    it("does not execute hooks after a timeout occurs", async () => {
      const order: string[] = []

      const hooks: LifecycleHook[] = [
        {
          name: "slow",
          fn: async () => {
            order.push("slow")

            await new Promise<void>((resolve) => {
              sleep(10).then(() => resolve())
            })
          },
        },
        { name: "never", fn: async () => void order.push("never") },
      ]

      const clock = new FakeClock(0)

      await runHooks({ phase: "startup", clock, logger, deadlineMs: 5 }, hooks)

      expect(order).toStrictEqual(["slow"])
    })

    it("does not execute hooks after the first failure when failFast is true", async () => {
      const order: string[] = []

      const hooks: LifecycleHook[] = [
        {
          name: "bad",
          fn: async () => {
            order.push("bad")
            throw new Error("boom")
          },
        },
        { name: "never", fn: async () => void order.push("never") },
      ]

      const clock = new FakeClock(0)

      await runHooks({ phase: "startup", clock, logger, deadlineMs: 1_000_000 }, hooks, {
        failFast: true,
      })

      expect(order).toStrictEqual(["bad"])
    })
  })
})
