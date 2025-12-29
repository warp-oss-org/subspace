import type { RandomSource } from "../../ports/random-source"
import { createBackoff } from "../create-backoff"
import { fullJitter } from "../jitter/full"
import { constant } from "../strategies/constant"
import { exponential } from "../strategies/exponential"

const fixedRandom = (value: number): RandomSource => ({
  next: () => value,
})

describe("createBackoff", () => {
  describe("passthrough", () => {
    it("passes through delay from strategy", () => {
      const policy = createBackoff({
        delay: constant({ delay: { milliseconds: 100 } }),
        min: { milliseconds: 0 },
        max: { milliseconds: 1000 },
      })

      expect(policy.getDelay(0)).toEqual({ milliseconds: 100 })
    })

    it("passes through exponential growth", () => {
      const policy = createBackoff({
        delay: exponential({ base: { milliseconds: 100 } }),
        min: { milliseconds: 0 },
        max: { milliseconds: 10000 },
      })

      expect(policy.getDelay(0)).toEqual({ milliseconds: 100 })
      expect(policy.getDelay(1)).toEqual({ milliseconds: 200 })
      expect(policy.getDelay(2)).toEqual({ milliseconds: 400 })
    })
  })

  describe("jitter", () => {
    it("applies jitter when provided", () => {
      const policy = createBackoff({
        delay: constant({ delay: { milliseconds: 100 } }),
        jitter: fullJitter(fixedRandom(0.5)),
        min: { milliseconds: 0 },
        max: { milliseconds: 1000 },
      })

      expect(policy.getDelay(0)).toEqual({ milliseconds: 50 })
    })

    it("composes strategy and jitter correctly", () => {
      const policy = createBackoff({
        delay: exponential({ base: { milliseconds: 100 } }),
        jitter: fullJitter(fixedRandom(0.5)),
        min: { milliseconds: 0 },
        max: { milliseconds: 10000 },
      })

      expect(policy.getDelay(0)).toEqual({ milliseconds: 50 })
      expect(policy.getDelay(1)).toEqual({ milliseconds: 100 })
      expect(policy.getDelay(2)).toEqual({ milliseconds: 200 })
    })

    it("clamps after jitter", () => {
      const policy = createBackoff({
        delay: constant({ delay: { milliseconds: 100 } }),
        jitter: fullJitter(fixedRandom(0.1)),
        min: { milliseconds: 50 },
        max: { milliseconds: 1000 },
      })

      expect(policy.getDelay(0)).toEqual({ milliseconds: 50 })
    })
  })

  describe("clamping", () => {
    it("clamps to min", () => {
      const policy = createBackoff({
        delay: constant({ delay: { milliseconds: 10 } }),
        min: { milliseconds: 50 },
        max: { milliseconds: 1000 },
      })

      expect(policy.getDelay(0)).toEqual({ milliseconds: 50 })
    })

    it("clamps to max", () => {
      const policy = createBackoff({
        delay: exponential({ base: { milliseconds: 100 } }),
        min: { milliseconds: 0 },
        max: { milliseconds: 500 },
      })

      expect(policy.getDelay(0)).toEqual({ milliseconds: 100 })
      expect(policy.getDelay(1)).toEqual({ milliseconds: 200 })
      expect(policy.getDelay(2)).toEqual({ milliseconds: 400 })
      expect(policy.getDelay(3)).toEqual({ milliseconds: 500 })
      expect(policy.getDelay(10)).toEqual({ milliseconds: 500 })
    })
  })

  describe("sanitization", () => {
    it("sanitizes NaN to min", () => {
      const badPolicy = {
        getDelay: () => ({ milliseconds: NaN }),
      }
      const policy = createBackoff({
        delay: badPolicy,
        min: { milliseconds: 100 },
        max: { milliseconds: 1000 },
      })

      expect(policy.getDelay(0)).toEqual({ milliseconds: 100 })
    })

    it("sanitizes Infinity to min then clamps to max", () => {
      const badPolicy = {
        getDelay: () => ({ milliseconds: Infinity }),
      }
      const policy = createBackoff({
        delay: badPolicy,
        min: { milliseconds: 0 },
        max: { milliseconds: 1000 },
      })

      expect(policy.getDelay(0)).toEqual({ milliseconds: 0 })
    })

    it("sanitizes negative to min", () => {
      const badPolicy = {
        getDelay: () => ({ milliseconds: -50 }),
      }
      const policy = createBackoff({
        delay: badPolicy,
        min: { milliseconds: 100 },
        max: { milliseconds: 1000 },
      })

      expect(policy.getDelay(0)).toEqual({ milliseconds: 100 })
    })

    it("floors to integer", () => {
      const policy = createBackoff({
        delay: constant({ delay: { milliseconds: 100.7 } }),
        min: { milliseconds: 0 },
        max: { milliseconds: 1000 },
      })

      expect(policy.getDelay(0)).toEqual({ milliseconds: 100 })
    })

    it("floors jittered value to integer", () => {
      const policy = createBackoff({
        delay: constant({ delay: { milliseconds: 100 } }),
        jitter: fullJitter(fixedRandom(0.333)),
        min: { milliseconds: 0 },
        max: { milliseconds: 1000 },
      })
      const result = policy.getDelay(0)

      expect(Number.isInteger(result.milliseconds)).toBe(true)
    })
  })

  describe("validation", () => {
    it("throws on negative min", () => {
      expect(() =>
        createBackoff({
          delay: constant({ delay: { milliseconds: 100 } }),
          min: { milliseconds: -1 },
          max: { milliseconds: 1000 },
        }),
      ).toThrow(RangeError)
    })

    it("throws on negative max", () => {
      expect(() =>
        createBackoff({
          delay: constant({ delay: { milliseconds: 100 } }),
          min: { milliseconds: 0 },
          max: { milliseconds: -1 },
        }),
      ).toThrow(RangeError)
    })

    it("throws on NaN min", () => {
      expect(() =>
        createBackoff({
          delay: constant({ delay: { milliseconds: 100 } }),
          min: { milliseconds: NaN },
          max: { milliseconds: 1000 },
        }),
      ).toThrow(RangeError)
    })

    it("throws on NaN max", () => {
      expect(() =>
        createBackoff({
          delay: constant({ delay: { milliseconds: 100 } }),
          min: { milliseconds: 0 },
          max: { milliseconds: NaN },
        }),
      ).toThrow(RangeError)
    })

    it("throws on Infinity min", () => {
      expect(() =>
        createBackoff({
          delay: constant({ delay: { milliseconds: 100 } }),
          min: { milliseconds: Infinity },
          max: { milliseconds: 1000 },
        }),
      ).toThrow(RangeError)
    })

    it("throws on Infinity max", () => {
      expect(() =>
        createBackoff({
          delay: constant({ delay: { milliseconds: 100 } }),
          min: { milliseconds: 0 },
          max: { milliseconds: Infinity },
        }),
      ).toThrow(RangeError)
    })

    it("throws when max < min", () => {
      expect(() =>
        createBackoff({
          delay: constant({ delay: { milliseconds: 100 } }),
          min: { milliseconds: 500 },
          max: { milliseconds: 100 },
        }),
      ).toThrow(RangeError)
    })

    it("allows min === max", () => {
      const policy = createBackoff({
        delay: constant({ delay: { milliseconds: 100 } }),
        min: { milliseconds: 50 },
        max: { milliseconds: 50 },
      })

      expect(policy.getDelay(0)).toEqual({ milliseconds: 50 })
    })

    it("allows min === 0", () => {
      const policy = createBackoff({
        delay: constant({ delay: { milliseconds: 0 } }),
        min: { milliseconds: 0 },
        max: { milliseconds: 1000 },
      })

      expect(policy.getDelay(0)).toEqual({ milliseconds: 0 })
    })
  })
})
