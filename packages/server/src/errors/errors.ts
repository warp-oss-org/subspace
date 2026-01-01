import { type ErrorCode, isAppError } from "@subspace/errors"
import type { StatusCode } from "../http/status-codes"

export type ErrorMapping = {
  status: StatusCode

  /**
   * User-facing error message.
   *
   * @remarks
   * Should not expose sensitive information.
   */
  message: string
}

export type FallbackMapping = ErrorMapping & {
  code: ErrorCode
}

export interface ErrorMappingsConfig {
  /**
   * Map of error code to status/message.
   * Unmapped AppErrors use fallback status/message but preserve their original code.
   */
  mappings: Partial<Record<ErrorCode, ErrorMapping>>

  /** Fallback for unmapped or unknown errors. */
  fallback?: FallbackMapping
}

export type ErrorResponse = {
  error: {
    status: StatusCode
    code: ErrorCode
    message: string
    requestId: string
  }
}

export type ErrorFormatter = (error: unknown, requestId: string) => ErrorResponse

const DEFAULT_FALLBACK: FallbackMapping = {
  code: "internal_error",
  status: 500,
  message: "An unexpected error occurred",
}

/**
 * Creates an error handler that maps AppErrors to responses.
 *
 * @remarks
 * - Mapped `AppError`s use their configured status/message
 * - Unmapped `AppError`s preserve their code but use fallback status/message
 * - Non-`AppError`s use fallback entirely
 */
export function createErrorFormatter(config: ErrorMappingsConfig): ErrorFormatter {
  const fallback = config.fallback ?? DEFAULT_FALLBACK

  return (error: unknown, requestId: string): ErrorResponse => {
    if (isAppError(error)) {
      const mapping = config.mappings[error.code]

      return {
        error: {
          code: error.code,
          status: mapping?.status ?? fallback.status,
          message: mapping?.message ?? fallback.message,
          requestId,
        },
      }
    }

    return {
      error: {
        code: fallback.code,
        status: fallback.status,
        message: fallback.message,
        requestId,
      },
    }
  }
}
