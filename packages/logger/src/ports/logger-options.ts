import type { LogLevelName } from "./log-level"

/**
 * Configuration options for a Logger instance.
 *
 * @remarks
 * These options define *policy*, not behavior:
 * - which log levels are emitted
 * - how logs are rendered for humans vs machines
 *
 * Concrete adapters (console, pino, otel, etc.) must honor these options,
 * but are free to choose how they are implemented internally.
 */
export type LoggerOptions = {
  /**
   * Minimum log level to emit.
   * Any log entries below this level are ignored.
   *
   * Example: "info" will suppress "trace" and "debug" logs.
   */
  level: LogLevelName

  /**
   * Whether to pretty-print log output for human readability.
   *
   * @remarks
   * - Intended for local development and debugging.
   * - Should be disabled in production where structured (JSON) logs
   *   are preferred for ingestion by log processors.
   */
  prettify?: boolean
}
