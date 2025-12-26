import type { LockLease } from "./lock-lease"
import type { AcquireOptions, TryAcquireOptions } from "./options"

export type LockKey = string

export interface Lock {
  /**
   * Acquire a lock for `key`, waiting up to `timeoutMs` if the lock is held.
   *
   * @returns The lease if acquired, or `null` if the timeout elapsed or the
   *          signal was aborted before acquisition.
   */
  acquire(key: LockKey, opts: AcquireOptions): Promise<LockLease | null>

  /**
   * Attempt to acquire a lock for `key` without waiting.
   *
   * @returns The lease if acquired immediately, or `null` if the lock is held.
   */
  tryAcquire(key: LockKey, opts: TryAcquireOptions): Promise<LockLease | null>
}
