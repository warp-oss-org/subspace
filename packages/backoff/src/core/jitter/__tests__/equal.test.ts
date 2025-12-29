import type { RandomSource } from "../../../ports/random-source"
import { equalJitter } from "../equal"

const fixedRandom = (value: number): RandomSource => ({
  next: () => value,
})

describe("equalJitter", () => {
  it("returns half delay when random returns 0", () => {
    const jitter = equalJitter(fixedRandom(0))

    expect(jitter.apply({ milliseconds: 100 })).toEqual({ milliseconds: 50 })
  })

  it("returns full delay when random returns ~1", () => {
    const jitter = equalJitter(fixedRandom(0.999))
    const result = jitter.apply({ milliseconds: 100 })

    expect(result.milliseconds).toBe(100)
  })

  it("returns 75% delay when random returns 0.5", () => {
    const jitter = equalJitter(fixedRandom(0.5))
    const result = jitter.apply({ milliseconds: 100 })

    expect(result.milliseconds).toBe(75)
  })

  it("guarantees at least 50% of base delay", () => {
    const jitter = equalJitter(fixedRandom(0))
    const result = jitter.apply({ milliseconds: 100 })

    expect(result.milliseconds).toBeGreaterThanOrEqual(50)
  })

  it("never exceeds base delay", () => {
    const jitter = equalJitter(fixedRandom(0.999999))
    const result = jitter.apply({ milliseconds: 100 })

    expect(result.milliseconds).toBeLessThanOrEqual(100)
  })

  it("returns integer milliseconds", () => {
    const jitter = equalJitter(fixedRandom(0.333))
    const result = jitter.apply({ milliseconds: 100 })

    expect(Number.isInteger(result.milliseconds)).toBe(true)
  })

  it("handles odd base delay", () => {
    const jitter = equalJitter(fixedRandom(0))

    expect(jitter.apply({ milliseconds: 99 })).toEqual({ milliseconds: 49 })
  })

  it("handles zero delay", () => {
    const jitter = equalJitter(fixedRandom(0.5))

    expect(jitter.apply({ milliseconds: 0 })).toEqual({ milliseconds: 0 })
  })

  it("range is [floor(delay/2), delay] inclusive", () => {
    const delay = { milliseconds: 100 }

    const lowerJitter = equalJitter(fixedRandom(0))
    expect(lowerJitter.apply(delay).milliseconds).toBe(50)

    const upperJitter = equalJitter(fixedRandom(0.999))
    expect(upperJitter.apply(delay).milliseconds).toBe(100)
  })
})
