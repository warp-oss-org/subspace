import type { LockKey } from "../../ports/lock"
import type { LockLease } from "../../ports/lock-lease"
import type { LockTtl, MillisecondsTtl } from "../../ports/options"

export type MemoryLeaseDeps = {
  onRelease: () => void
}

export type MemoryLeaseOpts = {
  ttl: LockTtl
}

export class MemoryLease implements LockLease {
  public readonly key: LockKey
  private readonly deps: MemoryLeaseDeps

  private released = false
  private ttlTimer: NodeJS.Timeout | null = null

  public constructor(key: LockKey, deps: MemoryLeaseDeps, opts: MemoryLeaseOpts) {
    this.key = key
    this.deps = deps
    this.scheduleAutoRelease(opts.ttl)
  }

  public async release(): Promise<void> {
    if (this.released) return

    this.released = true

    this.clearTtlTimer()
    this.onReleaseSafe()
  }

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

  private preventTimerFromBlockingExit(timer: NodeJS.Timeout | null): void {
    timer?.unref?.()
  }

  private scheduleAutoRelease(ttl: LockTtl): void {
    if (!Number.isFinite(ttl.milliseconds) || ttl.milliseconds <= 0) {
      throw new Error(`Invalid ttlMs: ${ttl.milliseconds} for lock ${this.key}`)
    }

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

  private onReleaseSafe(): void {
    try {
      this.deps.onRelease()
    } catch {
      // Swallow errors: in-memory release should never crash
    }
  }
}
