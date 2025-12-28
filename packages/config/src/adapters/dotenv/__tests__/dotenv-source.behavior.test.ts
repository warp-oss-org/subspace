import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { DotenvSource } from "../dotenv-source"

describe("DotenvSource behavior", () => {
  let cwd: string

  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), "dotenv-test-"))
  })

  afterEach(async () => {
    await fs.rm(cwd, { recursive: true })
  })

  it("parses key=value pairs", async () => {
    await fs.writeFile(path.join(cwd, ".env"), "PORT=3000\nHOST=localhost\nDEBUG=true")

    const source = new DotenvSource({ file: ".env", required: true, cwd })
    const result = await source.load()

    expect(result).toEqual({
      PORT: "3000",
      HOST: "localhost",
      DEBUG: "true",
    })
  })

  it("handles quoted values", async () => {
    await fs.writeFile(
      path.join(cwd, ".env"),
      `SINGLE='single quoted'\nDOUBLE="double quoted"\nUNQUOTED=no quotes`,
    )

    const source = new DotenvSource({ file: ".env", required: true, cwd })
    const result = await source.load()

    expect(result).toEqual({
      SINGLE: "single quoted",
      DOUBLE: "double quoted",
      UNQUOTED: "no quotes",
    })
  })

  it("ignores comments", async () => {
    await fs.writeFile(
      path.join(cwd, ".env"),
      "# This is a comment\nPORT=3000\n# Another comment\nHOST=localhost",
    )

    const source = new DotenvSource({ file: ".env", required: true, cwd })
    const result = await source.load()

    expect(result).toEqual({
      PORT: "3000",
      HOST: "localhost",
    })
  })

  it("returns empty object when file missing and not required", async () => {
    const source = new DotenvSource({ file: ".env", required: false, cwd })
    const result = await source.load()

    expect(result).toEqual({})
  })

  it("throws when file missing and required", async () => {
    const source = new DotenvSource({ file: ".env", required: true, cwd })

    await expect(source.load()).rejects.toThrow()
  })

  it("resolves path relative to cwd", async () => {
    const subdir = path.join(cwd, "config")
    await fs.mkdir(subdir)
    await fs.writeFile(path.join(subdir, ".env"), "KEY=value")

    const source = new DotenvSource({ file: ".env", required: true, cwd: subdir })
    const result = await source.load()

    expect(result).toEqual({ KEY: "value" })
  })
})
