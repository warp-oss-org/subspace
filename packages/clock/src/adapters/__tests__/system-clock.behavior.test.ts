import { SystemClock } from "../system-clock"

describe("SystemClock behavior", () => {
  describe("sleep", () => {
    it("resolves after ms elapses", async () => {
      const clock = new SystemClock()
      const start = Date.now()
      await clock.sleep(50)
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(45)
    })

    it("resolves early when signal is aborted mid-sleep", async () => {
      const clock = new SystemClock()
      const ac = new AbortController()

      const start = Date.now()
      const p = clock.sleep(5000, ac.signal)

      setTimeout(() => ac.abort(), 50)

      await p
      const elapsed = Date.now() - start
      expect(elapsed).toBeLessThan(500)
    })

    it("clears timeout when aborted", async () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout")
      const clock = new SystemClock()
      const ac = new AbortController()

      const p = clock.sleep(5000, ac.signal)
      ac.abort()
      await p

      expect(clearTimeoutSpy).toHaveBeenCalled()
      clearTimeoutSpy.mockRestore()
    })

    it("removes abort listener after normal completion", async () => {
      const clock = new SystemClock()
      const ac = new AbortController()
      const removeSpy = vi.spyOn(ac.signal, "removeEventListener")

      await clock.sleep(10, ac.signal)

      expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function))
      removeSpy.mockRestore()
    })
  })
})
