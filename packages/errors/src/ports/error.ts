export type ErrorCode = Lowercase<string>

/**
 * Contextual metadata attached to errors.
 * Use this to carry structured data (IDs, inputs, etc.) without string munging.
 */
export type ErrorContext = Readonly<Record<string, unknown>>

export interface AppError extends Error {
  /** Error code for programmatic handling */
  readonly code: ErrorCode

  /** Structured metadata for debugging */
  readonly context: ErrorContext

  /** `true` if retrying might succeed */
  readonly isRetryable: boolean

  /**
   * Indicates whether this is an expected runtime failure (true) or a programmer
   * error / invariant violation (false).
   *
   * @remarks
   * - Operational errors (`true)`: invalid input, not found, network timeout, rate limit.
   * - Non-operational errors (`false`): null pointer, invariant violation, corrupted state.
   *
   * Use this to decide whether the process/request/job can safely continue.
   * @default true
   */
  readonly isOperational: boolean

  readonly timestamp: Date

  /**
   * Underlying cause
   *
   * See {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause Error.cause}
   */
  readonly cause?: unknown
}

/**
 * Serialized error shape for logging, APIs, and transport.
 *
 * Designed to be JSON.stringify-safe.
 */
export type SerializedError = Readonly<{
  name: string
  code: string
  message: string
  context: Record<string, unknown>
  timestamp: string
  isOperational: boolean
  cause?: SerializedError
  stack?: string
}>
