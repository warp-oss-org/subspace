import { assertValidTimeMs } from "../../core/validation/validation"
import type { LockKey } from "../../ports/lock"
import type { LockLease } from "../../ports/lock-lease"
import type { LockTtl, MillisecondsTtl } from "../../ports/options"
import type { PgClientLease } from "./postgres-advisory-lock"

export type PostgresAdvisoryLeaseDeps = {
  lockId: bigint
  pg: PgClientLease
}

export type PostgresAdvisoryLeaseOpts = {
  ttl: LockTtl
}

export class PostgresAdvisoryLease implements LockLease {
  public readonly key: LockKey

  private released = false
  private ttlTimer: NodeJS.Timeout | null = null

  public constructor(
    key: LockKey,
    private readonly deps: PostgresAdvisoryLeaseDeps,
    opts: PostgresAdvisoryLeaseOpts,
  ) {
    this.key = key
    this.scheduleAutoRelease(opts.ttl)
  }

  public async release(): Promise<void> {
    if (this.released) return

    this.released = true

    this.clearTtlTimer()

    try {
      await this.deps.pg.client.query("select pg_advisory_unlock($1) as ok", [
        this.deps.lockId,
      ])
    } finally {
      await this.deps.pg.release()
    }
  }

  /**
   * Extends the lease TTL watchdog.
   *
   * Note: Postgres advisory locks have no server-side TTL and there is no reliable
   * "do I still own this lock?" check. If the underlying connection drops, the
   * lock is released by Postgres and this lease may be invalid without us knowing.
   *
   * This method only reschedules the local best-effort auto-release watchdog.
   */
  public async extend(ttl: LockTtl): Promise<boolean> {
    if (this.released) return false

    this.clearTtlTimer()
    this.scheduleAutoRelease(ttl)

    return true
  }

  private clearTtlTimer(): void {
    if (!this.ttlTimer) return

    clearTimeout(this.ttlTimer)
    this.ttlTimer = null
  }

  private preventTimerFromBlockingExit(timer: NodeJS.Timeout): void {
    timer.unref?.()
  }

  private scheduleAutoRelease(ttl: LockTtl): void {
    assertValidTimeMs(ttl.milliseconds, "lease ttl")

    const timer = this.armTtlWatchdog(ttl)
    this.preventTimerFromBlockingExit(timer)
  }

  private armTtlWatchdog(ttl: MillisecondsTtl) {
    this.ttlTimer = setTimeout(() => {
      this.release().catch(() => {
        // Swallow errors: background watchdog should not crash the process.
      })
    }, ttl.milliseconds)

    return this.ttlTimer
  }
}
