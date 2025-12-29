import type { AttemptContext } from "./attempt-context"

/**
 * Determines whether to retry after an error.
 */
export interface ErrorPredicate<E = Error> {
  shouldRetry(error: E, ctx: AttemptContext): boolean
}

/**
 * Determines whether to retry based on result (for APIs that don't throw).
 */
export interface ResultPredicate<T> {
  shouldRetry(result: T, ctx: AttemptContext): boolean
}
