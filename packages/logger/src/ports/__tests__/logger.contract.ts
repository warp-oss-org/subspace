import type { LogContext } from "../log-context"
import type { LoggerHarness } from "./logger-harness"

export function describeLoggerContract(h: LoggerHarness) {
  describe(`Logger contract: ${h.name}`, () => {
    it("child() inherits parent context and adds child context", () => {
      const { logger, read } = h.make({ level: "trace" })

      const parent = logger.child({ requestId: "req-1" })
      const child = parent.child({ userId: "u-1" } as unknown as Partial<LogContext> &
        Record<string, unknown>)

      child.info("hello")

      const logs = read()

      expect(logs).toHaveLength(1)
      expect(logs[0]?.payload).toMatchObject({
        requestId: "req-1",
        userId: "u-1",
      })
    })

    it("child() overrides on key conflict (shallow)", () => {
      const { logger, read } = h.make({ level: "trace" })

      const parent = logger.child({ requestId: "req-1" })
      const child = parent.child({ requestId: "req-2" })

      child.info("hello")

      const logs = read()

      expect(logs).toHaveLength(1)
      expect(logs[0]?.payload.requestId).toBe("req-2")
    })

    it("child() does not mutate the parent", () => {
      const { logger, read, clear } = h.make({ level: "trace" })

      const parent = logger.child({ requestId: "req-1" })
      const child = parent.child({ userId: "u-1" } as unknown as Partial<LogContext> &
        Record<string, unknown>)

      parent.info("parent")
      child.info("child")

      const logs = read()

      expect(logs).toHaveLength(2)
      expect(logs[0]?.payload).toMatchObject({ requestId: "req-1" })
      expect(logs[0]?.payload).not.toHaveProperty("userId")
      expect(logs[1]?.payload).toMatchObject({ requestId: "req-1", userId: "u-1" })

      clear()
    })

    it("per-call meta merges with context (meta overrides)", () => {
      const { logger, read } = h.make({ level: "trace" })

      const scoped = logger.child({ requestId: "req-1" })
      scoped.info("hello", { requestId: "req-2" } as any)

      const logs = read()

      expect(logs).toHaveLength(1)
      expect(logs[0]?.payload.requestId).toBe("req-2")
    })

    it("level filtering: logs below configured minimum are suppressed", () => {
      const { logger, read } = h.make({ level: "warn" })

      logger.info("info")
      logger.warn("warn")
      logger.error("error")

      const levels = read().map((l) => l.level)

      expect(levels).toEqual(["warn", "error"])
    })
  })
}
