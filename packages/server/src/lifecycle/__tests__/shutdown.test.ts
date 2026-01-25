import type { UnixMs } from "@subspace/clock"
import { FakeClock } from "@subspace/clock"
import type { Logger } from "@subspace/logger"
import { mock } from "vitest-mock-extended"
import type { Mock } from "../../tests/mock"
import type { LifecycleHook } from "../lifecycle-hook"
import { type ShutdownContext, shutdown } from "../shutdown"

describe("shutdown", () => {
  let clock: FakeClock
  let logger: Mock<Logger>

  beforeEach(() => {
    logger = mock<Logger>()
    clock = new FakeClock(0)
  })

  function baseCtx(overrides?: Partial<ShutdownContext>): ShutdownContext {
    return {
      server: { close: vi.fn((cb) => cb?.()) },
      deps: { logger, clock },
      deadlineMs: (clock.nowMs() + 10_000) as UnixMs,
      stopHooks: [],
      ...overrides,
    }
  }

  describe("flow", () => {
    it("logs shutdown start and completion", async () => {
      await shutdown(baseCtx())

      expect(logger.warn).toHaveBeenCalledWith("Shutting down gracefully...")
      expect(logger.info).toHaveBeenCalledWith("Shutdown complete", {
        failures: 0,
        ok: true,
        timedOut: false,
      })
    })

    it("runs server.close before consumer stop hooks", async () => {
      const order: string[] = []

      const stopHooks: LifecycleHook[] = [
        {
          name: "consumer",
          fn: async () => {
            order.push("consumer")
          },
        },
      ]

      const server = {
        close: (cb?: (err?: Error | null) => void) => {
          order.push("server.close")
          cb?.()
        },
      }

      await shutdown(baseCtx({ server, stopHooks }))

      expect(order).toEqual(["server.close", "consumer"])
    })

    it("continues after failures (failFast=false)", async () => {
      const executed: string[] = []

      const stopHooks: LifecycleHook[] = [
        {
          name: "fail",
          fn: async () => {
            executed.push("fail")
            throw new Error("boom")
          },
        },
        {
          name: "after",
          fn: async () => {
            executed.push("after")
          },
        },
      ]

      const result = await shutdown(baseCtx({ stopHooks }))

      expect(executed).toEqual(["fail", "after"])
      expect(result.failures).toHaveLength(1)
      expect(result.ok).toBe(false)
    })

    it("handles empty stopHooks", async () => {
      const result = await shutdown(baseCtx())

      expect(result.ok).toBe(true)
      expect(result.failures).toEqual([])
    })
  })

  describe("result", () => {
    it("returns ok when there are no failures and no timeout", async () => {
      const result = await shutdown(baseCtx())

      expect(result).toMatchObject({ ok: true, failures: [], timedOut: false })
    })

    it("returns not-ok when any failure occurs", async () => {
      const stopHooks: LifecycleHook[] = [
        {
          name: "fail",
          fn: async () => {
            throw new Error("boom")
          },
        },
      ]

      const result = await shutdown(baseCtx({ stopHooks }))

      expect(result.ok).toBe(false)
      expect(result.failures).toHaveLength(1)
      expect(result.failures[0]!.hook).toBe("fail")
    })

    it("returns not-ok when a timeout occurs", async () => {
      const stopHooks: LifecycleHook[] = [
        {
          name: "slow",
          fn: async ({ signal }) => {
            while (!signal.aborted) {
              clock.advance(1)
              await new Promise<void>((resolve) => setTimeout(resolve, 0))
            }
          },
        },
      ]

      const result = await shutdown(
        baseCtx({ stopHooks, deadlineMs: (clock.nowMs() + 1) as UnixMs }),
      )

      expect(result.ok).toBe(false)
      expect(result.timedOut).toBe(true)
    })

    it("aggregates failures from server.close and stopHooks", async () => {
      const server = {
        close: vi.fn((cb) => cb?.(new Error("close failed"))),
      }

      const stopHooks: LifecycleHook[] = [
        {
          name: "also-fails",
          fn: async () => {
            throw new Error("hook failed")
          },
        },
      ]

      const result = await shutdown(baseCtx({ server, stopHooks }))

      expect(result.failures).toHaveLength(2)
      expect(result.failures[0]!.hook).toBe("server.close")
      expect(result.failures[1]!.hook).toBe("also-fails")
    })
  })

  describe("server.close hook", () => {
    it("treats a close callback error as a failure", async () => {
      const server = {
        close: vi.fn((cb) => cb?.(new Error("close failed"))),
      }

      const result = await shutdown(baseCtx({ server }))

      expect(result.ok).toBe(false)
      expect(result.failures).toHaveLength(1)
      expect(result.failures[0]).toEqual({
        hook: "server.close",
        error: expect.any(Error),
      })
    })

    it("aborts close when deadline is exceeded during close", async () => {
      const server = {
        close: vi.fn(() => {
          // Never calls callback - simulates hanging close
        }),
      }

      const result = await shutdown(
        baseCtx({ server, deadlineMs: (clock.nowMs() + 1) as UnixMs }),
      )

      expect(result.timedOut).toBe(true)
    })
  })
})
