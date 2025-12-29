import type { Milliseconds } from "@subspace/clock"
import type { DelayPolicy } from "./delay-policy"
import type { RetryObserver } from "./observer"
import type { ErrorPredicate, ResultPredicate } from "./predicates"
/**
 * Configuration for retry behavior.
 *
 * @remarks
 * `maxAttempts` is total tries, not retries.
 * - maxAttempts=1 → try once, no retry
 * - maxAttempts=3 → try once + up to 2 retries
 *
 * Default predicates:
 * - errorPredicate: retry if not last attempt
 * - resultPredicate: none (results are accepted)
 */
export interface RetryConfig<T = unknown, E = Error> {
  /** Total attempts (not retries). Must be >= 1 */
  maxAttempts: number

  /** Delay policy between attempts */
  delay: DelayPolicy

  /** When to retry on thrown error */
  errorPredicate?: ErrorPredicate<E>

  /** When to retry based on result (for non-throwing APIs) */
  resultPredicate?: ResultPredicate<T>

  /** Lifecycle hooks */
  observer?: RetryObserver<T, E>

  /** Signal for cooperative cancellation */
  signal?: AbortSignal

  /**
   * Max wall-clock time for all attempts in ms.
   * After this, no new attempts start and current sleep is aborted.
   */
  maxElapsedMs?: Milliseconds
}
