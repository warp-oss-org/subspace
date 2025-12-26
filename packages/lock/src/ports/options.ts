import type { Milliseconds } from "./time"

export type MillisecondsTtl = { milliseconds: Milliseconds }
export type LockTtl = MillisecondsTtl

export type AcquireOptions = {
  /** How long the lease is valid before auto-expiring. */
  ttl: LockTtl

  /** Max time to wait for acquisition. Falls back to `LockConfig.defaultTimeoutMs` if omitted. */
  timeoutMs?: Milliseconds

  /** Aborts the wait early. Has no effect once the lock is acquired. */
  signal?: AbortSignal
}

export type TryAcquireOptions = {
  /** How long the lease is valid before auto-expiring. */
  ttl: LockTtl
}

export type LockConfig = {
  /** Default timeout for `acquire()` when `timeoutMs` is omitted. */
  defaultTimeoutMs: Milliseconds

  /** Interval between acquisition attempts while waiting. */
  pollMs: Milliseconds
}
