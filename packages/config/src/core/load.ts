import { type ZodMiniType, z } from "zod/mini"
import { EnvSource } from "../adapters/env/env-source"
import type { IConfig } from "../ports/config"
import type { ConfigSource } from "../ports/source"
import { Config } from "./config"

export type LoadConfigOptions<T extends Record<string, unknown>> = {
  /**
   * The canonical configuration schema used for validation and type coercion.
   *
   * @example
   * ```ts
   * const schema = z.object({
   *   port: z.number().min(0).max(65535),
   *   host: z.string(),
   * });
   * ```
   */
  schema: ZodMiniType<T>

  /**
   * An ordered list of configuration sources, merged in order with later sources overriding earlier ones.
   *
   * @example
   * ```ts
   * [new JsonSource('config.json'), new EnvSource()]
   * ```
   * @default [new EnvSource()]
   */
  sources?: ConfigSource[]

  /**
   * When enabled, flat keys from env-like sources may be expanded into nested objects using the `__` convention (e.g. `SERVER__PORT` → `server.port`).
   *
   * @default false
   * @example
   * ```ts
   * { expandEnv: true }
   * // Example: SERVER__PORT=3000 maps to { server: { port: 3000 } }
   * ```
   */
  expandEnv?: boolean
}

function isEnvLikeSourceName(name: string): boolean {
  return name === "env" || name === "dotenv" || name.startsWith("dotenv")
}

function parseEnvKeySegments(key: string): [string, ...string[]] | null {
  if (!key.includes("__")) return null

  const segments = key.split("__")
  if (segments.length === 0 || segments.some((segment) => segment.length === 0)) {
    return null
  }

  return segments.map((segment) => segment.toLowerCase()) as [string, ...string[]]
}

function setDeep(
  obj: Record<string, unknown>,
  segments: readonly string[],
  value: unknown,
): void {
  let current: Record<string, unknown> = obj
  const lastIndex = segments.length - 1
  for (const [i, segment] of segments.entries()) {
    if (i === lastIndex) {
      current[segment] = value
      return
    }
    const next = current[segment]
    if (typeof next !== "object" || next === null) {
      const created: Record<string, unknown> = {}
      current[segment] = created
      current = created
    } else {
      current = next as Record<string, unknown>
    }
  }
}

export async function loadConfig<T extends Record<string, unknown>>({
  schema,
  sources,
  expandEnv,
}: LoadConfigOptions<T>): Promise<IConfig<T>> {
  const merged: Record<string, unknown> = {}
  const provenance: Record<string, string> = {}
  const resolvedSources = sources ?? [new EnvSource()]

  for (const source of resolvedSources) {
    const values = await source.load()
    const shouldExpand = Boolean(expandEnv) && isEnvLikeSourceName(source.name)

    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) continue

      if (shouldExpand) {
        const segments = parseEnvKeySegments(key)
        if (segments !== null) {
          setDeep(merged, segments, value)
          provenance[segments[0]] = source.name
        } else {
          merged[key] = value
          provenance[key] = source.name
        }
      } else {
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
