import { Config } from "../config"

describe("Config", () => {
  const data = { PORT: 3000, DEBUG: false, HOST: "localhost" }
  const provenance = { PORT: "env", DEBUG: "default", HOST: "dotenv:.env" }
  const providedKeys = new Set(["PORT", "HOST", "STALE_KEY"])

  const config = new Config(data, provenance, providedKeys)

  describe("get", () => {
    it("returns value by key", () => {
      expect(config.get("PORT")).toBe(3000)
      expect(config.get("HOST")).toBe("localhost")
    })

    it("returns correct type for each key", () => {
      const port: number = config.get("PORT")
      const debug: boolean = config.get("DEBUG")
      const host: string = config.get("HOST")

      expect(typeof port).toBe("number")
      expect(typeof debug).toBe("boolean")
      expect(typeof host).toBe("string")
    })
  })

  describe("keys", () => {
    it("returns all config keys", () => {
      const keys = config.keys()

      expect(keys).toContain("PORT")
      expect(keys).toContain("DEBUG")
      expect(keys).toContain("HOST")
      expect(keys).toHaveLength(3)
    })

    it("does not include extra keys", () => {
      const keys = config.keys()

      expect(keys).not.toContain("STALE_KEY")
    })
  })

  describe("explain", () => {
    it("returns source name for key from source", () => {
      expect(config.explain("PORT")).toBe("env")
      expect(config.explain("HOST")).toBe("dotenv:.env")
    })

    it("returns 'default' for key from schema default", () => {
      expect(config.explain("DEBUG")).toBe("default")
    })
  })

  describe("sourcesUsed", () => {
    it("returns unique source names", () => {
      const sources = config.sourcesUsed()

      expect(sources).toContain("env")
      expect(sources).toContain("dotenv:.env")
    })

    it("includes 'default' when schema defaults were used", () => {
      const sources = config.sourcesUsed()

      expect(sources).toContain("env")
      expect(sources).toContain("dotenv:.env")
      expect(sources).toContain("default")
    })
  })

  describe("extras", () => {
    it("returns keys in sources but not in schema", () => {
      const extras = config.extras()

      expect(extras).toContain("STALE_KEY")
    })

    it("returns empty array when no extras", () => {
      const noExtrasConfig = new Config(
        data,
        provenance,
        new Set(["PORT", "HOST", "DEBUG"]),
      )

      expect(noExtrasConfig.extras()).toEqual([])
    })
  })

  describe("immutability", () => {
    it("data is frozen", () => {
      expect(() => {
        ;(config as any).data.PORT = 9999
      }).toThrow()
    })
  })
})
