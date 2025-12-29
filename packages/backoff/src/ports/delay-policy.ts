export type Milliseconds = number
export type MillisecondsDelay = { milliseconds: Milliseconds }

export type Delay = MillisecondsDelay

/**
 * Delay before the next attempt; attempt is 0-indexed.
 */
export interface DelayPolicy {
  getDelay(attempt: number): Delay
}
