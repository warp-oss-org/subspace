import { FakeClock } from "../fake-clock"

describe("FakeClock behavior", () => {
  describe("time control", () => {
    it("starts at the provided initial time", () => {
      const clock = new FakeClock(1000)

      expect(clock.nowMs()).toBe(1000)
    })

    it("defaults to 0 if no initial time provided", () => {
      const clock = new FakeClock()

      expect(clock.nowMs()).toBe(0)
    })

    it("advance() moves time forward", () => {
      const clock = new FakeClock(0)
      clock.advance(100)

      expect(clock.nowMs()).toBe(100)

      clock.advance(50)

      expect(clock.nowMs()).toBe(150)
    })

    it("set() moves time to exact value", () => {
      const clock = new FakeClock(0)

      clock.set(500)

      expect(clock.nowMs()).toBe(500)
    })
  })

  describe("sleep", () => {
    it("resolves instantly without advancing time", async () => {
      const clock = new FakeClock(0)
      await clock.sleep(1000)

      expect(clock.nowMs()).toBe(0)
    })
  })
})
