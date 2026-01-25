/**
 * Configuration container providing type-safe access to validated configuration values.
 *
 * @typeParam T - The shape of the configuration object, typically inferred from a Zod schema.
 *
 * @example
 * ```typescript
 * const config = await loadConfig({
 *   schema: z.object({
 *     PORT: z.coerce.number().default(3000),
 *     DATABASE_URL: z.string(),
 *   }),
 *   sources: [dotenvSource(".env"), envSource()],
 * })
 *
 * config.get("PORT")        // 3000
 * config.get("DATABASE_URL") // "postgres://..."
 * config.explain("PORT")    // "dotenv:.env"
 * ```
 */
export interface IConfig<T extends Record<string, unknown>> {
  /** Full validated config object */
  readonly value: T

  /**
   * Explains which source provided the final value for a key.
   *
   * @typeParam K - The key type, constrained to keys of T.
   * @param key - The configuration key to explain.
   * @returns The source name (e.g., "env", "dotenv:.env.defaults", "default" for Zod defaults).
   */
  explain<K extends keyof T & string>(key: K): string

  /**
   * Returns the names of all sources that contributed at least one value.
   *
   * @returns Array of source names in the order they were applied.
   */
  sourcesUsed(): string[]

  /**
   * Returns keys present in sources but not defined in the schema.
   *
   * Useful for detecting typos, stale config, or misconfigured sources.
   *
   * @returns Array of unrecognized keys.
   */
  unknownKeys(): string[]
}
