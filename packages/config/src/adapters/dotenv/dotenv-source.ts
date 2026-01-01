import fs from "node:fs/promises"
import path from "node:path"
import { parse } from "dotenv"
import type { ConfigSource } from "../../ports/source"

/**
 * Options for creating a dotenv configuration source.
 */
export type DotenvSourceOptions = {
  /**
   * Path to the .env file.
   *
   * Can be absolute or relative to `cwd`.
   *
   * @example ".env", ".env.production", "./config/.env.defaults"
   */
  file: string

  /**
   * Whether the file must exist.
   *
   * - `true`: Throws if file not found.
   * - `false`: Returns empty config if file not found.
   */
  required: boolean

  /**
   * Base directory for resolving relative paths.
   *
   * @default process.cwd()
   */
  cwd?: string
}

export class DotenvSource implements ConfigSource {
  readonly name: string

  constructor(private readonly opts: DotenvSourceOptions) {
    this.name = `dotenv:${opts.file}`
  }

  async load(): Promise<Record<string, unknown>> {
    const cwd = this.opts.cwd ?? process.cwd()
    const filePath = path.resolve(cwd, this.opts.file)

    try {
      const content = await fs.readFile(filePath, "utf-8")

      return parse(content)
    } catch (err) {
      if (!this.opts.required && (err as NodeJS.ErrnoException).code === "ENOENT") {
        return {}
      }
      throw err
    }
  }
}
