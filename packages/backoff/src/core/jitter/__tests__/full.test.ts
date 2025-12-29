import type { RandomSource } from "../../../ports/random-source"
import { fullJitter } from "../full"

const fixedRandom = (value: number): RandomSource => ({
  next: () => value,
})

const sequenceRandom = (values: number[]): RandomSource => {
  let i = 0
  return {
    next: () => values[i++] ?? 0,
  }
}

describe("fullJitter", () => {
  it("returns 0 when random returns 0", () => {
    const jitter = fullJitter(fixedRandom(0))

    expect(jitter.apply({ milliseconds: 100 })).toEqual({ milliseconds: 0 })
  })

  it("returns full delay when random returns ~1", () => {
    const jitter = fullJitter(fixedRandom(0.999))
    const result = jitter.apply({ milliseconds: 100 })

    expect(result.milliseconds).toBe(100)
  })

  it("returns half delay when random returns 0.5", () => {
    const jitter = fullJitter(fixedRandom(0.5))
    const result = jitter.apply({ milliseconds: 100 })

    expect(result.milliseconds).toBe(50)
  })

  it("returns integer milliseconds", () => {
    const jitter = fullJitter(fixedRandom(0.333))
    const result = jitter.apply({ milliseconds: 100 })

    expect(Number.isInteger(result.milliseconds)).toBe(true)
  })

  it("handles zero delay", () => {
    const jitter = fullJitter(fixedRandom(0.5))

    expect(jitter.apply({ milliseconds: 0 })).toEqual({ milliseconds: 0 })
  })

  it("produces different values with different random inputs", () => {
    const jitter = fullJitter(sequenceRandom([0.1, 0.5, 0.9]))
    const delay = { milliseconds: 100 }

    const r1 = jitter.apply(delay)
    const r2 = jitter.apply(delay)
    const r3 = jitter.apply(delay)

    expect(r1.milliseconds).toBe(10)
    expect(r2.milliseconds).toBe(50)
    expect(r3.milliseconds).toBe(90)
  })

  it("range is [0, delay] inclusive", () => {
    const lowerJitter = fullJitter(fixedRandom(0))
    expect(lowerJitter.apply({ milliseconds: 100 }).milliseconds).toBeGreaterThanOrEqual(
      0,
    )

    const upperJitter = fullJitter(fixedRandom(0.999999))
    expect(upperJitter.apply({ milliseconds: 100 }).milliseconds).toBeLessThanOrEqual(100)
  })
})
