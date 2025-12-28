import { type ZodType, z } from "zod"
import { EnvSource } from "../adapters/env/env-source"
import type { IConfig } from "../ports/config"
import type { ConfigSource } from "../ports/source"
import { Config } from "./config"

export type LoadConfigOptions<T extends Record<string, unknown>> = {
  schema: ZodType<T>
  sources?: ConfigSource[]
}

export async function loadConfig<T extends Record<string, unknown>>({
  schema,
  sources,
}: LoadConfigOptions<T>): Promise<IConfig<T>> {
  const merged: Record<string, unknown> = {}
  const provenance: Record<string, string> = {}
  const resolvedSources = sources ?? [new EnvSource()]

  for (const source of resolvedSources) {
    const values = await source.load()

    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) {
        merged[key] = value
        provenance[key] = source.name
      }
    }
  }

  const result = schema.safeParse(merged)

  if (!result.success) {
    throw new Error(`Configuration validation failed:\n${z.prettifyError(result.error)}`)
  }

  for (const key of Object.keys(result.data as object)) {
    if (!(key in provenance)) {
      provenance[key] = "default"
    }
  }

  return new Config<T>(result.data, provenance, new Set(Object.keys(merged)))
}
