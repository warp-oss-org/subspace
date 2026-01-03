import { FakeClock } from "@subspace/clock"
import type { Logger } from "@subspace/logger"
import { mock } from "vitest-mock-extended"

import type { LifecycleHook } from "../lifecycle"
import { startup } from "../startup"

describe("startup", () => {
  let logger: ReturnType<typeof mock<Logger>>
  let clock: FakeClock

  beforeEach(() => {
    logger = mock<Logger>()
    clock = new FakeClock(0)
  })

  it("logs that startup hooks are running", async () => {
    await startup({
      clock,
      logger,
      deadlineMs: 10_000,
      startHooks: [],
    })

    expect(logger.debug).toHaveBeenCalledWith("Running startup hooks...")
  })

  it("returns ok=true when all hooks succeed before the deadline", async () => {
    const hooks: LifecycleHook[] = [
      { name: "a", fn: async () => {} },
      { name: "b", fn: async () => {} },
    ]

    const res = await startup({
      clock,
      logger,
      deadlineMs: 10_000,
      startHooks: hooks,
    })

    expect(res).toStrictEqual({ ok: true, failures: [], timedOut: false })
  })

  it("returns ok=false and stops after the first failure (failFast)", async () => {
    const ran: string[] = []

    const hooks: LifecycleHook[] = [
      {
        name: "first",
        fn: async () => {
          ran.push("first")
          throw new Error("boom")
        },
      },
      {
        name: "second",
        fn: async () => {
          ran.push("second")
        },
      },
    ]

    const res = await startup({
      clock,
      logger,
      deadlineMs: 10_000,
      startHooks: hooks,
    })

    expect(ran).toStrictEqual(["first"])
    expect(res.ok).toBe(false)
    expect(res.timedOut).toBe(false)
    expect(res.failures).toHaveLength(1)
    expect(res.failures[0]?.hook).toBe("first")
  })

  it("returns ok=false when the deadline is already exceeded", async () => {
    clock.set(1000)

    const hooks: LifecycleHook[] = [
      {
        name: "never",
        fn: async () => {
          throw new Error("should not run")
        },
      },
    ]

    const res = await startup({
      clock,
      logger,
      deadlineMs: 1000,
      startHooks: hooks,
    })

    expect(res).toStrictEqual({ ok: false, failures: [], timedOut: true })
  })
})
