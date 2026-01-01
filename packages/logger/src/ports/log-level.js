export const logLevelNames = ["trace", "debug", "info", "warn", "error", "fatal"];
/**
 * Numeric log severity levels.
 *
 * These values define the ordering of log levels for comparison
 * and filtering (higher = more severe).
 */
export const LogLevels = {
    /** Finest-grained diagnostic information. */
    Trace: 10,
    /** Debug-level information useful during development and investigation. */
    Debug: 20,
    /** High-level informational messages about normal operation. */
    Info: 30,
    /** Indications of potential issues or unexpected situations. */
    Warn: 40,
    /** Errors that indicate a failure in the current operation. */
    Error: 50,
    /** Severe errors after which the process may be unable to continue. */
    Fatal: 60,
};
//# sourceMappingURL=log-level.js.map