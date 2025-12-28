/**
 * A source of configuration values.
 *
 * A ConfigSource is responsible only for *loading* raw configuration.
 * It does not perform validation, coercion, or merging.
 *
 * Sources are evaluated in order; later sources override earlier ones.
 */
export interface ConfigSource {
  /**
   * Human-readable name for debugging and provenance.
   * Example: "env", "dotenv:.env.defaults", "json:config.json"
   */
  readonly name: string

  /**
   * Load configuration values.
   *
   * - Env/dotenv sources return flat string values
   * - JSON sources may return nested objects
   * - Returning undefined for a key means "value not provided"
   * - Zod handles coercion and validation downstream
   */
  load(): Promise<Record<string, unknown>>
}
