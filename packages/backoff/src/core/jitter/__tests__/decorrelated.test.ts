import type { RandomSource } from "../../../ports/random-source"
import { decorrelatedJitter } from "../decorrelated"

const fixedRandom = (value: number): RandomSource => ({
  next: () => value,
})

describe("decorrelatedJitter", () => {
  it("returns min when random returns 0", () => {
    const jitter = decorrelatedJitter({ min: { milliseconds: 10 } }, fixedRandom(0))

    const result = jitter.apply({ milliseconds: 100 })
    expect(result).toEqual({ milliseconds: 10 })
  })

  it("returns delay * 3 when random returns ~1", () => {
    const jitter = decorrelatedJitter({ min: { milliseconds: 10 } }, fixedRandom(0.999))

    const result = jitter.apply({ milliseconds: 100 })
    expect(result.milliseconds).toBeGreaterThanOrEqual(295)
    expect(result.milliseconds).toBeLessThanOrEqual(300)
  })

  it("never returns below min", () => {
    const jitter = decorrelatedJitter({ min: { milliseconds: 50 } }, fixedRandom(0))

    const result = jitter.apply({ milliseconds: 100 })
    expect(result.milliseconds).toBeGreaterThanOrEqual(50)
  })

  it("returns integer milliseconds", () => {
    const jitter = decorrelatedJitter({ min: { milliseconds: 10 } }, fixedRandom(0.333))

    const result = jitter.apply({ milliseconds: 100 })
    expect(Number.isInteger(result.milliseconds)).toBe(true)
  })

  it("handles min equal to delay", () => {
    const jitter = decorrelatedJitter({ min: { milliseconds: 100 } }, fixedRandom(0.5))

    const result = jitter.apply({ milliseconds: 100 })
    expect(result.milliseconds).toBe(200)
  })

  it("handles min greater than delay", () => {
    const jitter = decorrelatedJitter({ min: { milliseconds: 200 } }, fixedRandom(0.5))
    const result = jitter.apply({ milliseconds: 100 })
    expect(result.milliseconds).toBe(250)
  })

  it("range is [min, delay * 3]", () => {
    const min = { milliseconds: 10 }
    const delay = { milliseconds: 100 }

    const lowerJitter = decorrelatedJitter({ min }, fixedRandom(0))
    expect(lowerJitter.apply(delay).milliseconds).toBe(10)

    const upperJitter = decorrelatedJitter({ min }, fixedRandom(0.999))
    expect(upperJitter.apply(delay).milliseconds).toBeLessThanOrEqual(300)
  })
})
