import type { ConfigSource } from "../../ports/source"

export class ObjectSource implements ConfigSource {
  readonly name = "object:overrides"

  constructor(private readonly obj: Record<string, unknown>) {}

  async load(): Promise<Record<string, unknown>> {
    return { ...this.obj }
  }
}
