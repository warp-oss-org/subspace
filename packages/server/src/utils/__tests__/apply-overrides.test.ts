import { applyOverrides } from "../apply-overrides"

describe("applyOverrides", () => {
  describe("base cases", () => {
    it("returns base unchanged when overrides is undefined", () => {
      const base = { a: 1, b: "hello" }
      const result = applyOverrides(base, undefined)

      expect(result).toEqual(base)
    })

    it("returns base unchanged when overrides is empty object", () => {
      const base = { a: 1, b: "hello" }
      const result = applyOverrides(base, {})
      expect(result).toEqual(base)
    })

    it("does not mutate the base object", () => {
      const base = { a: 1, nested: { b: 2 } }
      const original = JSON.parse(JSON.stringify(base))
      applyOverrides(base, { a: 99, nested: { b: 99 } })

      expect(base).toEqual(original)
    })
  })

  describe("shallow merging", () => {
    it("overrides primitive values", () => {
      const base = { a: 1, b: "hello", c: true }
      const result = applyOverrides(base, { a: 2, c: false })

      expect(result).toEqual({ a: 2, b: "hello", c: false })
    })

    it("ignores undefined override values", () => {
      const base = { a: 1, b: 2 }
      const result = applyOverrides(base, { a: undefined!, b: 3 })

      expect(result).toEqual({ a: 1, b: 3 })
    })

    it("allows null as an override value", () => {
      const base = { a: 1, b: "hello" } as { a: number; b: string | null }
      const result = applyOverrides(base, { b: null })
      expect(result).toEqual({ a: 1, b: null })
    })
  })

  describe("deep merging plain objects", () => {
    it("deep merges nested plain objects", () => {
      const base = {
        config: { timeout: 1000, retries: 3 },
        name: "app",
      }
      const result = applyOverrides(base, {
        config: { timeout: 5000 },
      })

      expect(result).toEqual({
        config: { timeout: 5000, retries: 3 },
        name: "app",
      })
    })

    it("deep merges multiple levels", () => {
      const base = {
        a: {
          b: {
            c: { value: 1, keep: true },
            d: "unchanged",
          },
        },
      }
      const result = applyOverrides(base, {
        a: { b: { c: { value: 2 } } },
      })

      expect(result).toEqual({
        a: {
          b: {
            c: { value: 2, keep: true },
            d: "unchanged",
          },
        },
      })
    })

    it("handles Object.create(null) objects as plain objects", () => {
      const nullProto = Object.create(null) as { x: number }
      nullProto.x = 1

      const base = { config: nullProto }
      const result = applyOverrides(base, { config: { x: 2 } })

      expect(result.config.x).toBe(2)
    })
  })

  describe("atomic replacement of non-plain objects", () => {
    it("replaces class instances atomically", () => {
      class Clock {
        constructor(public now: Date) {}
        getTime() {
          return this.now.getTime()
        }
      }
      const baseClock = new Clock(new Date("2025-01-01"))
      const overrideClock = new Clock(new Date("2026-01-01"))

      const base = { clock: baseClock, name: "app" }
      const result = applyOverrides(base, { clock: overrideClock })

      expect(result.clock).toBe(overrideClock)
      expect(result.clock.getTime()).toBe(overrideClock.getTime())
    })

    it("replaces arrays atomically (no merging)", () => {
      const base = { items: [1, 2, 3], name: "list" }
      const result = applyOverrides(base, { items: [4, 5] })

      expect(result).toEqual({ items: [4, 5], name: "list" })
    })

    it("replaces Date instances atomically", () => {
      const baseDate = new Date("2025-01-01")
      const overrideDate = new Date("2026-06-15")
      const base = { createdAt: baseDate }
      const result = applyOverrides(base, { createdAt: overrideDate })

      expect(result.createdAt).toBe(overrideDate)
    })

    it("replaces Map instances atomically", () => {
      const baseMap = new Map([["a", 1]])
      const overrideMap = new Map([["b", 2]])

      const base = { lookup: baseMap }
      const result = applyOverrides(base, { lookup: overrideMap })

      expect(result.lookup).toBe(overrideMap)
    })

    it("replaces Set instances atomically", () => {
      const baseSet = new Set([1, 2])
      const overrideSet = new Set([3, 4, 5])

      const base = { ids: baseSet }
      const result = applyOverrides(base, { ids: overrideSet })

      expect(result.ids).toBe(overrideSet)
    })

    it("replaces functions atomically", () => {
      const baseFn = () => "base"
      const overrideFn = () => "override"

      const base = { handler: baseFn }
      const result = applyOverrides(base, { handler: overrideFn })

      expect(result.handler).toBe(overrideFn)
      expect(result.handler()).toBe("override")
    })

    it("replaces RegExp instances atomically", () => {
      const base = { pattern: /abc/ }
      const result = applyOverrides(base, { pattern: /xyz/i })

      expect(result.pattern).toEqual(/xyz/i)
    })
  })

  describe("mixed scenarios", () => {
    it("handles mix of deep merge and atomic replace at same level", () => {
      class Logger {
        constructor(public level: string) {}
      }
      const base = {
        config: { timeout: 1000, debug: false },
        logger: new Logger("info"),
      }
      const result = applyOverrides(base, {
        config: { debug: true },
        logger: new Logger("debug"),
      })

      expect(result.config).toEqual({ timeout: 1000, debug: true })
      expect(result.logger.level).toBe("debug")
    })

    it("replaces plain object entirely when override is class instance", () => {
      class Config {
        constructor(public value: number) {}
      }
      const base = { settings: { value: 1, extra: true } }
      const result = applyOverrides(base, { settings: new Config(2) as any })

      expect(result.settings).toBeInstanceOf(Config)
      expect((result.settings as any).value).toBe(2)
    })

    it("deep merges when base is class instance but override is plain object", () => {
      class Settings {
        timeout = 1000
        retries = 3
      }
      const base = { settings: new Settings() }
      const result = applyOverrides(base, { settings: { timeout: 5000 } as any })

      expect(result.settings).toEqual({ timeout: 5000 })
    })
  })

  describe("realistic AppServices scenarios", () => {
    it("overrides single service in nested structure", () => {
      class JobStore {
        type = "redis"
      }
      class UploadStore {
        type = "s3"
      }
      class InMemoryJobStore {
        type = "memory"
      }

      type AppServices = {
        stores: {
          jobs: JobStore
          uploads: UploadStore
        }
        config: { timeout: number }
      }

      const base: AppServices = {
        stores: {
          jobs: new JobStore(),
          uploads: new UploadStore(),
        },
        config: { timeout: 1000 },
      }

      const result = applyOverrides(base, {
        stores: { jobs: new InMemoryJobStore() as any },
      })

      expect(result.stores.jobs.type).toBe("memory")
      expect(result.stores.uploads.type).toBe("s3")
      expect(result.config.timeout).toBe(1000)
    })

    it("overrides clock and config together", () => {
      class SystemClock {
        now() {
          return new Date()
        }
      }
      class FrozenClock {
        constructor(private frozen: Date) {}
        now() {
          return this.frozen
        }
      }

      const base = {
        clock: new SystemClock(),
        retry: { maxAttempts: 3, delayMs: 100 },
      }

      const frozen = new Date("2026-01-19T12:00:00Z")
      const result = applyOverrides(base, {
        clock: new FrozenClock(frozen),
        retry: { maxAttempts: 1 },
      })

      expect(result.clock.now()).toEqual(frozen)
      expect(result.retry).toEqual({ maxAttempts: 1, delayMs: 100 })
    })

    it("preserves unmentioned branches entirely", () => {
      const base = {
        a: { a1: 1, a2: 2 },
        b: { b1: 3, b2: 4 },
        c: { c1: 5, c2: 6 },
      }
      const result = applyOverrides(base, {
        b: { b1: 99 },
      })

      expect(result.a).toEqual({ a1: 1, a2: 2 })
      expect(result.b).toEqual({ b1: 99, b2: 4 })
      expect(result.c).toEqual({ c1: 5, c2: 6 })
    })
  })

  describe("edge cases", () => {
    it("handles empty nested objects", () => {
      const base = { nested: {} }
      const result = applyOverrides(base, { nested: { newKey: "value" } } as any)

      expect(result.nested).toEqual({ newKey: "value" })
    })

    it("handles override adding new keys to nested object", () => {
      const base = { config: { a: 1 } } as { config: { a: number; b?: number } }
      const result = applyOverrides(base, { config: { b: 2 } })

      expect(result.config).toEqual({ a: 1, b: 2 })
    })

    it("preserves symbol keys from base", () => {
      const sym = Symbol("test")
      const base = { [sym]: "symbol-value", regular: "value" }
      const result = applyOverrides(base, { regular: "changed" })

      expect(result[sym]).toBe("symbol-value")
      expect(result.regular).toBe("changed")
    })

    it("handles deeply nested arrays inside objects", () => {
      const base = {
        level1: {
          level2: {
            items: [1, 2, 3],
            value: "keep",
          },
        },
      }
      const result = applyOverrides(base, {
        level1: { level2: { items: [4, 5] } },
      })

      expect(result.level1.level2.items).toEqual([4, 5])
      expect(result.level1.level2.value).toBe("keep")
    })
  })
})
