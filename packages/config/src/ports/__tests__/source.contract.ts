import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { ConfigSource } from "../source"

export type ConfigSourceHarness = {
  name: string
  make: (cwd: string) => Promise<{
    source: ConfigSource
    cleanup?: () => Promise<void>
  }>
  setup: (cwd: string) => Promise<void>
  expectedValue: () => Record<string, string | undefined>
}

export function describeConfigSourceContract(h: ConfigSourceHarness) {
  describe(`${h.name} (ConfigSource contract)`, () => {
    let cwd: string
    let source: ConfigSource
    let cleanup: (() => Promise<void>) | undefined

    beforeEach(async () => {
      cwd = await fs.mkdtemp(path.join(os.tmpdir(), "config-test-"))
      await h.setup(cwd)
      const result = await h.make(cwd)

      source = result.source
      cleanup = result.cleanup
    })

    afterEach(async () => {
      await cleanup?.()
      await fs.rm(cwd, { recursive: true, force: true })
    })

    it("has a name", () => {
      expect(source.name).toBeDefined()
      expect(typeof source.name).toBe("string")
    })

    it("load() resolves to a plain object", async () => {
      const result = await source.load()

      expect(result).not.toBeNull()
      expect(typeof result).toBe("object")
      expect(Array.isArray(result)).toBe(false)
      expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
    })

    it("load() values are string | undefined", async () => {
      const result = await source.load()

      for (const [key, value] of Object.entries(result)) {
        expect(typeof key).toBe("string")
        expect(value === undefined || typeof value === "string").toBe(true)
      }
    })

    it("load() is idempotent", async () => {
      const a = await source.load()
      const b = await source.load()

      expect(b).toEqual(a)
    })

    it("load() does not leak a mutable reference", async () => {
      const first = await source.load()
      ;(first as Record<string, unknown>).__CONFIG_TEST_MUTATION__ = "x"

      const second = await source.load()
      expect(second).not.toHaveProperty("__CONFIG_TEST_MUTATION__")
    })

    it("load() returns expected values", async () => {
      const result = await source.load()

      expect(result).toMatchObject(h.expectedValue())
    })
  })
}
