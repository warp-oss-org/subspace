import type { RetryConfig } from "./retry-config"
import type { RetryFn } from "./retry-fn"
import type { RetryResult } from "./retry-result"

/**
 * Executes functions with retry logic.
 *
 * @remarks
 * AbortSignal behavior:
 * - If already aborted at start → throws AbortError immediately
 * - If aborted while sleeping → aborts sleep, throws AbortError
 * - If aborted during fn → fn's responsibility, executor stops retrying
 *
 * Error typing:
 * - Caught values are typed as E at the boundary
 * - In practice, implementation treats caught as unknown
 *
 * Throwing behavior:
 * - execute() throws on exhaustion, abort, or timeout
 * - tryExecute() returns result wrapper for retry/abort/timeout failures
 * - Both propagate programmer errors (predicate/observer throws)
 */
export interface IRetryExecutor {
  execute<T, E = Error>(fn: RetryFn<T>, config: RetryConfig<T, E>): Promise<T>
  tryExecute<T, E = Error>(
    fn: RetryFn<T>,
    config: RetryConfig<T, E>,
  ): Promise<RetryResult<T, E>>
}
