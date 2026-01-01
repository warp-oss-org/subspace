import type { AppError, ErrorCode } from "../../ports/error"
import { BaseError } from "../base-error"

/**
 * Convert any thrown value to an AppError.
 *
 * - BaseError passes through unchanged
 * - Error instances are wrapped with isOperational: false (assume unexpected)
 * - Non-Error values are wrapped with isOperational: false (likely a bug)
 *
 * @param err - The caught value
 * @param fallbackCode - Code to use if not already an AppError. Default: "unknown"
 */
export function toAppError(err: unknown, fallbackCode: ErrorCode = "unknown"): AppError {
  if (err instanceof BaseError) {
    return err
  }

  if (err instanceof Error) {
    return new BaseError(err.message, {
      code: fallbackCode,
      cause: err,
      isOperational: false,
    })
  }

  return new BaseError(typeof err === "string" ? err : "Unknown error", {
    code: fallbackCode,
    context: typeof err === "string" ? {} : { value: err },
    isOperational: false,
  })
}
