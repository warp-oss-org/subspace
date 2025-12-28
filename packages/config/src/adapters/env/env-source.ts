import type { ConfigSource } from "../../ports/source"

export type EnvSourceOptions = {
  prefix?: string
  env?: Record<string, string | undefined>
}

export class EnvSource implements ConfigSource {
  readonly name = "env"
  private readonly prefix?: string | undefined
  private readonly env: Record<string, string | undefined>

  constructor(options: EnvSourceOptions = {}) {
    this.prefix = options.prefix
    this.env = options.env ?? process.env
  }

  async load(): Promise<Record<string, unknown>> {
    if (!this.prefix) return { ...this.env }

    const filtered: Record<string, string | undefined> = {}

    for (const [key, value] of Object.entries(this.env)) {
      if (key.startsWith(this.prefix)) {
        filtered[key.slice(this.prefix.length)] = value
      }
    }

    return filtered
  }
}
