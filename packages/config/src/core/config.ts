import type { IConfig } from "../ports/config"

export class Config<T extends Record<string, unknown>> implements IConfig<T> {
  constructor(
    private readonly data: Readonly<T>,
    private readonly provenance: Record<string, string>,
    private readonly mergedKeys: ReadonlySet<string>,
  ) {
    Object.freeze(this.data)
  }

  get value(): T {
    return this.data
  }

  keys(): (keyof T & string)[] {
    return Object.keys(this.data) as Array<keyof T & string>
  }

  explain<K extends keyof T & string>(key: K): string {
    return this.provenance[String(key)] ?? "default"
  }

  sourcesUsed(): string[] {
    const sources: string[] = Object.values(this.provenance)

    return [...new Set(sources)]
  }

  unknownKeys(): string[] {
    const used = new Set(this.keys().map(String))

    return [...this.mergedKeys].filter((k) => !used.has(k))
  }
}
