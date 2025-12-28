import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { z } from "zod"
import { DotenvSource } from "../../adapters/dotenv/dotenv-source"
import { EnvSource } from "../../adapters/env/env-source"
import { JsonSource } from "../../adapters/json/json-source"
import { loadConfig } from "../load"

describe("loadConfig e2e", () => {
  let cwd: string

  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), "config-e2e-"))
  })

  afterEach(async () => {
    await fs.rm(cwd, { recursive: true })
  })

  describe("single source", () => {
    it("loads from env source", async () => {
      const schema = z.object({
        PORT: z.coerce.number(),
        HOST: z.string(),
      })

      const config = await loadConfig({
        schema,
        sources: [new EnvSource({ env: { PORT: "3000", HOST: "localhost" } })],
      })

      expect(config.get("PORT")).toBe(3000)
      expect(config.get("HOST")).toBe("localhost")
    })

    it("loads from dotenv source", async () => {
      await fs.writeFile(path.join(cwd, ".env"), "PORT=3000\nHOST=localhost")

      const schema = z.object({
        PORT: z.coerce.number(),
        HOST: z.string(),
      })

      const config = await loadConfig({
        schema,
        sources: [new DotenvSource({ file: ".env", required: true, cwd })],
      })

      expect(config.get("PORT")).toBe(3000)
      expect(config.get("HOST")).toBe("localhost")
    })

    it("loads from json source", async () => {
      await fs.writeFile(
        path.join(cwd, "config.json"),
        JSON.stringify({ PORT: 3000, HOST: "localhost" }),
      )

      const schema = z.object({
        PORT: z.number(),
        HOST: z.string(),
      })

      const config = await loadConfig({
        schema,
        sources: [new JsonSource({ file: "config.json", required: true, cwd })],
      })

      expect(config.get("PORT")).toBe(3000)
      expect(config.get("HOST")).toBe("localhost")
    })
  })

  describe("multiple sources", () => {
    it("merges keys from multiple sources", async () => {
      await fs.writeFile(path.join(cwd, ".env"), "HOST=localhost")

      const schema = z.object({
        PORT: z.coerce.number(),
        HOST: z.string(),
      })

      const config = await loadConfig({
        schema,
        sources: [
          new DotenvSource({ file: ".env", required: true, cwd }),
          new EnvSource({ env: { PORT: "3000" } }),
        ],
      })

      expect(config.get("PORT")).toBe(3000)
      expect(config.get("HOST")).toBe("localhost")
    })

    it("combines dotenv defaults with env overrides", async () => {
      await fs.writeFile(path.join(cwd, ".env.defaults"), "PORT=8080\nHOST=0.0.0.0")

      const schema = z.object({
        PORT: z.coerce.number(),
        HOST: z.string(),
      })

      const config = await loadConfig({
        schema,
        sources: [
          new DotenvSource({ file: ".env.defaults", required: true, cwd }),
          new EnvSource({ env: { PORT: "3000" } }),
        ],
      })

      expect(config.get("PORT")).toBe(3000)
      expect(config.get("HOST")).toBe("0.0.0.0")
    })

    it("combines json base with dotenv environment with env runtime", async () => {
      await fs.writeFile(
        path.join(cwd, "config.json"),
        JSON.stringify({ PORT: 8080, HOST: "0.0.0.0", DEBUG: false }),
      )
      await fs.writeFile(path.join(cwd, ".env"), "HOST=localhost")

      const schema = z.object({
        PORT: z.coerce.number(),
        HOST: z.string(),
        DEBUG: z.coerce.boolean(),
      })

      const config = await loadConfig({
        schema,
        sources: [
          new JsonSource({ file: "config.json", required: true, cwd }),
          new DotenvSource({ file: ".env", required: true, cwd }),
          new EnvSource({ env: { PORT: "3000" } }),
        ],
      })

      expect(config.get("PORT")).toBe(3000)
      expect(config.get("HOST")).toBe("localhost")
      expect(config.get("DEBUG")).toBe(false)
    })

    it("skips missing optional sources without error", async () => {
      const schema = z.object({
        PORT: z.coerce.number(),
      })

      const config = await loadConfig({
        schema,
        sources: [
          new DotenvSource({ file: ".env.missing", required: false, cwd }),
          new EnvSource({ env: { PORT: "3000" } }),
        ],
      })

      expect(config.get("PORT")).toBe(3000)
    })

    it("undefined values do not override defined values", async () => {
      await fs.writeFile(path.join(cwd, ".env"), "PORT=3000")

      const schema = z.object({
        PORT: z.coerce.number(),
      })

      const config = await loadConfig({
        schema,
        sources: [
          new DotenvSource({ file: ".env", required: true, cwd }),
          new EnvSource({ env: { PORT: undefined } }),
        ],
      })

      expect(config.get("PORT")).toBe(3000)
    })
  })

  describe("precedence", () => {
    it("later sources override earlier sources", async () => {
      const schema = z.object({
        PORT: z.coerce.number(),
      })

      const config = await loadConfig({
        schema,
        sources: [
          new EnvSource({ env: { PORT: "8080" } }),
          new EnvSource({ env: { PORT: "3000" } }),
        ],
      })

      expect(config.get("PORT")).toBe(3000)
    })

    it("env overrides dotenv", async () => {
      await fs.writeFile(path.join(cwd, ".env"), "PORT=8080")

      const schema = z.object({
        PORT: z.coerce.number(),
      })

      const config = await loadConfig({
        schema,
        sources: [
          new DotenvSource({ file: ".env", required: true, cwd }),
          new EnvSource({ env: { PORT: "3000" } }),
        ],
      })

      expect(config.get("PORT")).toBe(3000)
    })

    it("dotenv overrides json", async () => {
      await fs.writeFile(path.join(cwd, "config.json"), JSON.stringify({ PORT: 8080 }))
      await fs.writeFile(path.join(cwd, ".env"), "PORT=3000")

      const schema = z.object({
        PORT: z.coerce.number(),
      })

      const config = await loadConfig({
        schema,
        sources: [
          new JsonSource({ file: "config.json", required: true, cwd }),
          new DotenvSource({ file: ".env", required: true, cwd }),
        ],
      })

      expect(config.get("PORT")).toBe(3000)
    })

    it("last source wins for same key", async () => {
      await fs.writeFile(path.join(cwd, ".env.a"), "PORT=1000")
      await fs.writeFile(path.join(cwd, ".env.b"), "PORT=2000")
      await fs.writeFile(path.join(cwd, ".env.c"), "PORT=3000")

      const schema = z.object({
        PORT: z.coerce.number(),
      })

      const config = await loadConfig({
        schema,
        sources: [
          new DotenvSource({ file: ".env.a", required: true, cwd }),
          new DotenvSource({ file: ".env.b", required: true, cwd }),
          new DotenvSource({ file: ".env.c", required: true, cwd }),
        ],
      })

      expect(config.get("PORT")).toBe(3000)
    })

    it("three source chain: json < dotenv < env", async () => {
      await fs.writeFile(
        path.join(cwd, "config.json"),
        JSON.stringify({ A: "json", B: "json", C: "json" }),
      )
      await fs.writeFile(path.join(cwd, ".env"), "B=dotenv\nC=dotenv")

      const schema = z.object({
        A: z.string(),
        B: z.string(),
        C: z.string(),
      })

      const config = await loadConfig({
        schema,
        sources: [
          new JsonSource({ file: "config.json", required: true, cwd }),
          new DotenvSource({ file: ".env", required: true, cwd }),
          new EnvSource({ env: { C: "env" } }),
        ],
      })

      expect(config.get("A")).toBe("json")
      expect(config.get("B")).toBe("dotenv")
      expect(config.get("C")).toBe("env")
    })
  })

  describe("schema validation", () => {
    it("coerces string to number", async () => {
      const schema = z.object({
        PORT: z.coerce.number(),
      })

      const config = await loadConfig({
        schema,
        sources: [new EnvSource({ env: { PORT: "3000" } })],
      })

      expect(config.get("PORT")).toBe(3000)
      expect(typeof config.get("PORT")).toBe("number")
    })

    it("coerces string to boolean", async () => {
      const schema = z.object({
        DEBUG: z.coerce.boolean(),
      })

      const config = await loadConfig({
        schema,
        sources: [new EnvSource({ env: { DEBUG: "true" } })],
      })

      expect(config.get("DEBUG")).toBe(true)
      expect(typeof config.get("DEBUG")).toBe("boolean")
    })

    it("applies default values", async () => {
      const schema = z.object({
        PORT: z.coerce.number().default(3000),
        HOST: z.string().default("localhost"),
      })

      const config = await loadConfig({
        schema,
        sources: [new EnvSource({ env: {} })],
      })

      expect(config.get("PORT")).toBe(3000)
      expect(config.get("HOST")).toBe("localhost")
    })

    it("throws on missing required field", async () => {
      const schema = z.object({
        PORT: z.coerce.number(),
        REQUIRED_KEY: z.string(),
      })

      await expect(
        loadConfig({
          schema,
          sources: [new EnvSource({ env: { PORT: "3000" } })],
        }),
      ).rejects.toThrow()
    })

    it("throws on invalid type", async () => {
      const schema = z.object({
        PORT: z.coerce.number(),
      })

      await expect(
        loadConfig({
          schema,
          sources: [new EnvSource({ env: { PORT: "not-a-number" } })],
        }),
      ).rejects.toThrow()
    })
  })

  describe("provenance", () => {
    it("explains which source provided each key", async () => {
      await fs.writeFile(path.join(cwd, ".env"), "HOST=localhost")

      const schema = z.object({
        PORT: z.coerce.number(),
        HOST: z.string(),
      })

      const config = await loadConfig({
        schema,
        sources: [
          new DotenvSource({ file: ".env", required: true, cwd }),
          new EnvSource({ env: { PORT: "3000" } }),
        ],
      })

      expect(config.explain("PORT")).toBe("env")
      expect(config.explain("HOST")).toBe("dotenv:.env")
    })

    it("reports 'default' for schema defaults", async () => {
      const schema = z.object({
        PORT: z.coerce.number().default(3000),
      })

      const config = await loadConfig({
        schema,
        sources: [new EnvSource({ env: {} })],
      })

      expect(config.explain("PORT")).toBe("default")
    })

    it("lists all sources used", async () => {
      await fs.writeFile(path.join(cwd, ".env"), "HOST=localhost")

      const schema = z.object({
        PORT: z.coerce.number(),
        HOST: z.string(),
      })

      const config = await loadConfig({
        schema,
        sources: [
          new DotenvSource({ file: ".env", required: true, cwd }),
          new EnvSource({ env: { PORT: "3000" } }),
        ],
      })

      const sources = config.sourcesUsed()
      expect(sources).toContain("env")
      expect(sources).toContain("dotenv:.env")
    })

    it("identifies extra keys not in schema", async () => {
      const schema = z.object({
        PORT: z.coerce.number(),
      })

      const config = await loadConfig({
        schema,
        sources: [new EnvSource({ env: { PORT: "3000", STALE_KEY: "unused" } })],
      })

      expect(config.extras()).toContain("STALE_KEY")
    })
  })

  describe("config access", () => {
    it("get() returns typed value", async () => {
      const schema = z.object({
        PORT: z.coerce.number(),
        HOST: z.string(),
        DEBUG: z.coerce.boolean(),
      })

      const config = await loadConfig({
        schema,
        sources: [
          new EnvSource({ env: { PORT: "3000", HOST: "localhost", DEBUG: "true" } }),
        ],
      })

      const port: number = config.get("PORT")
      const host: string = config.get("HOST")
      const debug: boolean = config.get("DEBUG")

      expect(port).toBe(3000)
      expect(host).toBe("localhost")
      expect(debug).toBe(true)
    })

    it("keys() returns all config keys", async () => {
      const schema = z.object({
        PORT: z.coerce.number(),
        HOST: z.string(),
      })

      const config = await loadConfig({
        schema,
        sources: [new EnvSource({ env: { PORT: "3000", HOST: "localhost" } })],
      })

      const keys = config.keys()
      expect(keys).toContain("PORT")
      expect(keys).toContain("HOST")
      expect(keys).toHaveLength(2)
    })
  })

  describe("prefix filtering", () => {
    it("filters env vars by prefix", async () => {
      const schema = z.object({
        PORT: z.coerce.number(),
        HOST: z.string(),
      })

      const config = await loadConfig({
        schema,
        sources: [
          new EnvSource({
            env: {
              APP_PORT: "3000",
              APP_HOST: "localhost",
              OTHER_KEY: "ignored",
              PATH: "/usr/bin",
            },
            prefix: "APP_",
          }),
        ],
      })

      expect(config.get("PORT")).toBe(3000)
      expect(config.get("HOST")).toBe("localhost")
      expect(config.extras()).not.toContain("OTHER_KEY")
      expect(config.extras()).not.toContain("PATH")
    })

    it("strips prefix from keys", async () => {
      const schema = z.object({
        DATABASE_URL: z.string(),
      })

      const config = await loadConfig({
        schema,
        sources: [
          new EnvSource({
            env: { MYAPP_DATABASE_URL: "postgres://localhost" },
            prefix: "MYAPP_",
          }),
        ],
      })

      expect(config.get("DATABASE_URL")).toBe("postgres://localhost")
    })
  })

  describe("process.env integration", () => {
    it("loads from process.env by default", async () => {
      const original = process.env.TEST_E2E_PORT
      process.env.TEST_E2E_PORT = "9999"

      try {
        const schema = z.object({
          TEST_E2E_PORT: z.coerce.number(),
        })

        const config = await loadConfig({
          schema,
          sources: [new EnvSource({})],
        })

        expect(config.get("TEST_E2E_PORT")).toBe(9999)
      } finally {
        if (original === undefined) {
          delete process.env.TEST_E2E_PORT
        } else {
          process.env.TEST_E2E_PORT = original
        }
      }
    })
  })
})
