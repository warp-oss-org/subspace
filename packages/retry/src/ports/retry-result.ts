import type { Milliseconds } from "@subspace/clock"

export type SuccessfulRetryResult<T> = {
  success: true
  value: T
  attempts: number
  elapsedMs: Milliseconds
}

export type FailedRetryResult<E = Error> = {
  success: false
  error: E
  attempts: number
  elapsedMs: number
  aborted: boolean
  timedOut: boolean
}

export type RetryResult<T, E = Error> = SuccessfulRetryResult<T> | FailedRetryResult<E>
