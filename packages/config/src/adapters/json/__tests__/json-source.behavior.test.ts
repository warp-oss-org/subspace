import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { JsonSource } from "../json-source"

describe("JsonSource behavior", () => {
  let cwd: string

  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), "json-test-"))
  })

  afterEach(async () => {
    await fs.rm(cwd, { recursive: true })
  })

  it("parses JSON object", async () => {
    await fs.writeFile(
      path.join(cwd, "config.json"),
      JSON.stringify({ PORT: 3000, HOST: "localhost", DEBUG: true }),
    )

    const source = new JsonSource({ file: "config.json", required: true, cwd })
    const result = await source.load()

    expect(result).toEqual({
      PORT: 3000,
      HOST: "localhost",
      DEBUG: true,
    })
  })

  it("preserves nested objects", async () => {
    await fs.writeFile(
      path.join(cwd, "config.json"),
      JSON.stringify({
        db: { host: "localhost", port: 5432 },
        redis: { url: "redis://localhost:6379" },
      }),
    )

    const source = new JsonSource({ file: "config.json", required: true, cwd })
    const result = await source.load()

    expect(result).toEqual({
      db: { host: "localhost", port: 5432 },
      redis: { url: "redis://localhost:6379" },
    })
  })

  it("returns empty object when file missing and not required", async () => {
    const source = new JsonSource({ file: "config.json", required: false, cwd })
    const result = await source.load()

    expect(result).toEqual({})
  })

  it("throws when file missing and required", async () => {
    const source = new JsonSource({ file: "config.json", required: true, cwd })

    await expect(source.load()).rejects.toThrow()
  })

  it("throws on invalid JSON", async () => {
    await fs.writeFile(path.join(cwd, "config.json"), "{ invalid json }")

    const source = new JsonSource({ file: "config.json", required: true, cwd })

    await expect(source.load()).rejects.toThrow()
  })

  it("resolves path relative to cwd", async () => {
    const subdir = path.join(cwd, "config")
    await fs.mkdir(subdir)
    await fs.writeFile(path.join(subdir, "app.json"), JSON.stringify({ KEY: "value" }))

    const source = new JsonSource({ file: "app.json", required: true, cwd: subdir })
    const result = await source.load()

    expect(result).toEqual({ KEY: "value" })
  })
})
