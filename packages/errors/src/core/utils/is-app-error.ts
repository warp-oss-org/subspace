import type { AppError } from "../../ports/error"

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}

function isValidDate(v: unknown): v is Date {
  return v instanceof Date && Number.isFinite(v.valueOf())
}

/**
 * Type guard to check if a value is an AppError.
 *
 * @example
 * ```ts
 * try {
 *   // ...
 * } catch (err) {
 *   if (isAppError(err)) {
 *     console.log(err.code, err.context)
 *   }
 * }
 * ```
 */
export function isAppError(e: unknown): e is AppError {
  if (!isRecord(e)) return false
  const err = e as unknown as AppError

  return (
    typeof err.code === "string" &&
    isRecord(err.context) &&
    typeof err.isRetryable === "boolean" &&
    typeof err.isOperational === "boolean" &&
    isValidDate(err.timestamp) &&
    typeof err.message === "string" &&
    typeof err.name === "string"
  )
}
