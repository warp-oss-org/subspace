import { type AppError, type ErrorCode, isAppError } from "@subspace/errors"
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

export type ErrorContextTransformer = (
  error: AppError,
) => Record<string, unknown> | undefined

export interface ErrorMappingsConfig {
  /**
   * Map of error code to status/message.
   * Unmapped AppErrors use fallback status/message but preserve their original code.
   */
  mappings: Partial<Record<ErrorCode, ErrorMapping>>

  /** Fallback for unmapped or unknown errors. */
  fallback?: FallbackMapping

  /**
   * Transform error context before including in response.
   * Return undefined to exclude context from response.
   */
  transformContext?: ErrorContextTransformer
}

export type ErrorResponseBody = {
  status: StatusCode
  code: ErrorCode
  message: string
  requestId: string
  [key: string]: unknown
}

export type ErrorResponse = {
  error: ErrorResponseBody
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
      const extra = extractExtraContext(config, error)

      return {
        error: {
          ...(extra && { ...extra }),
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

function extractExtraContext(
  config: ErrorMappingsConfig,
  error: AppError,
): Record<string, unknown> | undefined {
  try {
    return config.transformContext?.(error) ?? {}
  } catch {
    return undefined
  }
}
