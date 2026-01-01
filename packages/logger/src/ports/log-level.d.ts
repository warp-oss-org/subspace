export declare const logLevelNames: readonly [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
]
export type LogLevelName = (typeof logLevelNames)[number]
/**
 * Numeric log severity levels.
 *
 * These values define the ordering of log levels for comparison
 * and filtering (higher = more severe).
 */
export declare const LogLevels: {
  /** Finest-grained diagnostic information. */
  readonly Trace: 10
  /** Debug-level information useful during development and investigation. */
  readonly Debug: 20
  /** High-level informational messages about normal operation. */
  readonly Info: 30
  /** Indications of potential issues or unexpected situations. */
  readonly Warn: 40
  /** Errors that indicate a failure in the current operation. */
  readonly Error: 50
  /** Severe errors after which the process may be unable to continue. */
  readonly Fatal: 60
}
export type LogLevel = (typeof LogLevels)[keyof typeof LogLevels]
//# sourceMappingURL=log-level.d.ts.map
