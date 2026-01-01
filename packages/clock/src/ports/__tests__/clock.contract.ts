import { describe, expect, it } from "vitest"
import type { Clock } from "../clock"

export type ClockHarness = {
  name: string
  make: () => Clock
}

export function describeClockContract(h: ClockHarness) {
  describe(`${h.name} (Clock contract)`, () => {
    describe("TimeSource", () => {
      it("now() returns a Date", () => {
        const clock = h.make()
        const result = clock.now()

        expect(result).toBeInstanceOf(Date)
      })

      it("nowMs() returns a number", () => {
        const clock = h.make()
        const result = clock.nowMs()

        expect(typeof result).toBe("number")
      })

      it("now() and nowMs() are consistent", () => {
        const clock = h.make()
        const date = clock.now()
        const ms = clock.nowMs()

        expect(Math.abs(date.getTime() - ms)).toBeLessThan(5)
      })
    })

    describe("Sleeper", () => {
      it("sleep() resolves", async () => {
        const clock = h.make()

        await expect(clock.sleep(0)).resolves.toBeUndefined()
      })

      it("sleep() resolves early when signal is already aborted", async () => {
        const clock = h.make()
        const ac = new AbortController()
        ac.abort()

        await expect(clock.sleep(10_000, ac.signal)).resolves.toBeUndefined()
      })
    })
  })
}
