import type { PollOptions, PollUntilFn } from "../../core/polling/poll-until"
import type { Sleep } from "../../core/polling/sleep"
import type { Clock } from "../../core/time/clock"
import type { Lock, LockKey } from "../../ports/lock"
import type { LockLease } from "../../ports/lock-lease"
import type { AcquireOptions, LockConfig, TryAcquireOptions } from "../../ports/options"
import { PostgresAdvisoryLease } from "./postgres-advisory-lease"

export type PgClientLease = {
  client: {
    query: (
      sql: string,
      params?: unknown[],
    ) => Promise<{ rows: Array<Record<string, unknown>> }>
  }
  release: () => Promise<void>
}

export type PostgresAdvisoryLockDeps = {
  clock: Clock
  sleep: Sleep
  pollUntil: PollUntilFn
  leaseClient: () => Promise<PgClientLease>
  hashKey: (key: LockKey) => bigint
}

export class PostgresAdvisoryLock implements Lock {
  public constructor(
    private readonly deps: PostgresAdvisoryLockDeps,
    private readonly config: LockConfig,
  ) {}

  async acquire(key: LockKey, opts: AcquireOptions): Promise<LockLease | null> {
    if (opts.signal?.aborted) return null

    const budget = opts.timeoutMs ?? this.config.defaultTimeoutMs

    if (!Number.isFinite(budget) || budget < 0) {
      throw new Error(`Invalid ttlMs: ${opts.ttl.milliseconds} for lock ${key}`)
    }

    if (budget === 0) return await this.tryAcquire(key, { ttl: opts.ttl })

    const pollOpts: PollOptions = {
      pollMs: this.config.pollMs,
      timeoutMs: budget,
      ...(opts.signal && { signal: opts.signal }),
    }

    const acquired = await this.deps.pollUntil(
      () => this.tryAcquire(key, { ttl: opts.ttl }),
      { clock: this.deps.clock, sleep: this.deps.sleep },
      pollOpts,
    )

    return acquired.ok ? acquired.value : null
  }

  async tryAcquire(key: LockKey, opts: TryAcquireOptions): Promise<LockLease | null> {
    const lockId = this.deps.hashKey(key)
    const lease = await this.deps.leaseClient()

    try {
      const res = await lease.client.query("select pg_try_advisory_lock($1) as ok", [
        lockId,
      ])
      const ok = Boolean(res.rows?.[0]?.ok)

      if (!ok) {
        await lease.release()
        return null
      }

      return new PostgresAdvisoryLease(key, { lockId, pg: lease }, { ttl: opts.ttl })
    } catch (err) {
      await lease.release()
      throw err
    }
  }
}
