import type { AppError, ErrorContext, SerializedError } from "../ports/error"

export type BaseErrorOptions<C extends string = string> = Readonly<{
  code: C
  context?: ErrorContext
  cause?: unknown
  isRetryable?: boolean
  isOperational?: boolean
}>

export class BaseError<C extends string = string> extends Error implements AppError {
  readonly code: C
  readonly context: ErrorContext
  readonly isRetryable: boolean
  readonly isOperational: boolean
  readonly timestamp: Date

  constructor(message: string, options: BaseErrorOptions<C>) {
    super(message, { cause: options.cause })

    this.name = this.constructor.name
    this.code = options.code
    this.context = Object.freeze({ ...options.context }) ?? Object.freeze({})
    this.isRetryable = options.isRetryable ?? false
    this.isOperational = options.isOperational ?? true
    this.timestamp = new Date()

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  toJSON(): SerializedError {
    return serializeError(this)
  }
}

/**
 * Options for error serialization.
 */
export type SerializeOptions = Readonly<{
  /** Include stack traces in output. Default: false */
  includeStack?: boolean
}>

/**
 * Serialize any error (or thrown value) to a consistent shape.
 *
 * Handles:
 * - BaseError instances (preserves code, context, etc.)
 * - Standard Error instances (code defaults to "UNKNOWN")
 * - Non-Error thrown values (wrapped with context)
 */
export function serializeError(
  err: unknown,
  options?: SerializeOptions,
): SerializedError {
  const includeStack = options?.includeStack ?? false

  if (err instanceof BaseError) {
    return {
      name: err.name,
      code: err.code,
      message: err.message,
      context: { ...err.context },
      isOperational: err.isOperational,
      timestamp: err.timestamp.toISOString(),
      ...(err.cause !== undefined && { cause: serializeError(err.cause, options) }),
      ...(includeStack && err.stack && { stack: err.stack }),
    }
  }

  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause
    return {
      name: err.name,
      code: "UNKNOWN",
      message: err.message,
      context: {},
      isOperational: false,
      timestamp: new Date().toISOString(),
      ...(cause !== undefined && { cause: serializeError(cause, options) }),
      ...(includeStack && err.stack && { stack: err.stack }),
    }
  }

  return {
    name: "NonErrorThrown",
    code: "UNKNOWN",
    message: typeof err === "string" ? err : "Unknown error",
    context: { value: err },
    isOperational: false,
    timestamp: new Date().toISOString(),
  }
}
