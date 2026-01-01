import type { ErrorCode } from "../../ports/error"
import { BaseError, type BaseErrorOptions } from "../base-error"

/**
 * Factory function to create a BaseError with less boilerplate.
 *
 * @example
 * ```ts
 * throw createError("USER_NOT_FOUND", "No user with that ID", {
 *   context: { userId: "123" }
 * })
 * ```
 */
export function createError<C extends ErrorCode>(
  code: C,
  message: string,
  options?: Omit<BaseErrorOptions<C>, "code">,
): BaseError<C> {
  return new BaseError(message, { code, ...options })
}
