import { systemRandom } from "../random"

describe("systemRandom", () => {
  it("returns a number", () => {
    const result = systemRandom.next()

    expect(typeof result).toBe("number")
  })

  it("returns a value >= 0", () => {
    for (let i = 0; i < 100; i++) {
      expect(systemRandom.next()).toBeGreaterThanOrEqual(0)
    }
  })

  it("returns a value < 1", () => {
    for (let i = 0; i < 100; i++) {
      expect(systemRandom.next()).toBeLessThan(1)
    }
  })
  it("returns a number in [0, 1)", () => {
    for (let i = 0; i < 1000; i++) {
      const value = systemRandom.next()

      expect(typeof value).toBe("number")
      expect(Number.isFinite(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})
