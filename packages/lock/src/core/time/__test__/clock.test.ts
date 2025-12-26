import { describe, expect, it } from "vitest"
import { type Clock, SystemClock } from "../clock"

describe("Clock (contract)", () => {
  it("now() returns a Date instance", () => {
    const clock: Clock = new SystemClock()

    const now = clock.now()

    expect(now).toBeInstanceOf(Date)
  })

  it("nowMs() returns a number representing milliseconds since epoch", () => {
    const clock: Clock = new SystemClock()

    const nowMs = clock.nowMs()

    expect(typeof nowMs).toBe("number")
    expect(Number.isFinite(nowMs)).toBe(true)
  })

  it("now() and nowMs() are consistent with each other", () => {
    const clock: Clock = new SystemClock()

    const now = clock.now()
    const nowMs = clock.nowMs()

    const delta = Math.abs(now.getTime() - nowMs)

    expect(delta).toBeLessThanOrEqual(1)
  })
})
