import type { AttemptContext, RetryAttemptInfo } from "./attempt-context"

/**
 * Lifecycle hooks for observability.
 *
 * @remarks
 * Observer methods should not throw. If they do, executor treats it as
 * programmer error and propagates (even from tryExecute).
 */
export interface RetryObserver<T, E = Error> {
  onAttempt?(ctx: AttemptContext): Promise<void>
  onError?(error: E, info: RetryAttemptInfo): Promise<void>
  onResultRetry?(result: T, info: RetryAttemptInfo): Promise<void>
  onSuccess?(result: T, ctx: AttemptContext): Promise<void>
  onExhausted?(error: E, info: RetryAttemptInfo): Promise<void>
  onAborted?(ctx: AttemptContext): Promise<void>
}
