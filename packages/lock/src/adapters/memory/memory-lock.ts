import type { PollOptions, PollUntilFn } from "../../core/polling/poll-until"
import type { Sleep } from "../../core/polling/sleep"
import type { Clock } from "../../core/time/clock"
import { assertValidTimeMs } from "../../core/validation/validation"
import type { Lock, LockKey } from "../../ports/lock"
import type { LockLease } from "../../ports/lock-lease"
import type { AcquireOptions, LockConfig, TryAcquireOptions } from "../../ports/options"
import { MemoryLease } from "./memory-lock-lease"

export type MemoryLockDeps = {
  clock: Clock
  sleep: Sleep
  pollUntil: PollUntilFn
}

export type MemoryLockConfig = LockConfig

type HeldLock = {
  lease: MemoryLease
}

export class MemoryLock implements Lock {
  private readonly locks = new Map<LockKey, HeldLock>()

  public constructor(
    private readonly deps: MemoryLockDeps,
    private readonly config: MemoryLockConfig,
  ) {}

  public async acquire(key: LockKey, opts: AcquireOptions): Promise<LockLease | null> {
    if (opts.signal?.aborted) return null

    const timeoutMs = opts.timeoutMs ?? this.config.defaultTimeoutMs

    assertValidTimeMs(timeoutMs, "acquire timeoutMs")

    if (timeoutMs === 0) return await this.tryAcquire(key, { ttl: opts.ttl })

    const pollOpts: PollOptions = {
      pollMs: this.config.pollMs,
      timeoutMs,
      ...(opts.signal && { signal: opts.signal }),
    }

    const acquired = await this.deps.pollUntil(
      () => this.tryAcquire(key, { ttl: opts.ttl }),
      { clock: this.deps.clock, sleep: this.deps.sleep },
      pollOpts,
    )

    return acquired.ok ? acquired.value : null
  }

  public async tryAcquire(
    key: LockKey,
    opts: TryAcquireOptions,
  ): Promise<LockLease | null> {
    if (this.locks.has(key)) return null

    const lease = new MemoryLease(
      key,
      {
        onRelease: () => {
          const current = this.locks.get(key)
          if (current?.lease === lease) {
            this.locks.delete(key)
          }
        },
      },
      { ttl: opts.ttl },
    )

    this.locks.set(key, { lease })
    return lease
  }
}
