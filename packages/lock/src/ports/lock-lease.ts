import type { LockKey } from "./lock"
import type { LockTtl } from "./options"

export interface LockLease {
  /** The key this lease holds. */
  readonly key: LockKey

  /**
   * Release the lock if still owned. Idempotent—safe to call multiple times.
   */
  release(): Promise<void>

  /**
   * Extend the lease TTL.
   *
   * Returns `false` if the lease is no longer owned.
   *
   * Note: Some adapters (e.g., Postgres advisory locks) cannot verify ownership
   * server-side. For these, `extend` reschedules a local auto-release watchdog
   * but cannot guarantee the lock is still held if the underlying connection dropped.
   */
  extend(ttl: LockTtl): Promise<boolean>
}
