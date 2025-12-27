import type { Milliseconds } from "./time"

export type TimeSource = {
  /**
   * Current time as a Date object.
   *
   * @remarks
   * Avoid for arithmetic; prefer `nowMs()` for calculations.
   */
  now(): Date

  /** Current time as milliseconds since Unix epoch. */
  nowMs(): Milliseconds
}

export interface Sleeper {
  /** Delay execution for `ms` milliseconds. Resolves early if `signal` is aborted. */
  sleep(ms: Milliseconds, signal?: AbortSignal): Promise<void>
}

export type Clock = TimeSource & Sleeper
