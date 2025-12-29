import type { Milliseconds, UnixMs } from "@subspace/clock"

export interface AttemptContext {
  /** 0-indexed attempt number */
  attempt: number

  /** Total attempts so far (attempt + 1) */
  attemptsSoFar: number

  /** Epoch ms when first attempt started */
  startedAt: UnixMs

  /** ms since first attempt started */
  elapsedMs: Milliseconds

  /** Signal for cooperative cancellation */
  signal?: AbortSignal
}

export interface RetryAttemptInfo extends AttemptContext {
  /** ms until next attempt, null if exhausted/aborted */
  nextDelayMs: Milliseconds | null

  /** True if this is the final attempt */
  isLastAttempt: boolean
}
