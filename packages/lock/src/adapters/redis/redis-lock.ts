import type { PollOptions, PollUntilFn } from "../../core/polling/poll-until"
import type { Sleep } from "../../core/polling/sleep"
import type { Clock } from "../../core/time/clock"
import { assertValidTimeMs } from "../../core/validation/validation"
import type { Lock, LockKey } from "../../ports/lock"
import type { LockLease } from "../../ports/lock-lease"
import type { AcquireOptions, LockConfig, TryAcquireOptions } from "../../ports/options"
import type { RedisClient } from "./redis-client"
import { RedisLease } from "./redis-lock-lease"

/**
 * A prefix that scopes an adapter instance to a partition of a shared keyspace
 * (e.g. a Redis cluster).
 *
 * @remarks
 * This prefix represents **ownership of a keyspace partition** by a specific
 * subsystem or responsibility (cache, sessions, rate limiting, etc.), not
 * a single global prefix for an entire application.
 *
 * Multiple adapters within the same application may target the same Redis
 * cluster while using different prefixes to avoid collisions and ensure
 * isolation:
 *
 * - `app:prod:cache:`
 * - `app:prod:sessions:`
 * - `app:prod:ratelimit:`
 *
 * Adapters must treat this value as an opaque string and simply prepend it to keys.
 */
export type KeyspacePrefix = string

export type RedisLockDeps = {
  client: RedisClient
  clock: Clock
  sleep: Sleep
  generateToken: () => string
  pollUntil: PollUntilFn
}

export type RedisLockConfig = LockConfig & {
  keyspacePrefix: KeyspacePrefix
}

export class RedisLock implements Lock {
  private readonly prefix: string

  public constructor(
    private readonly deps: RedisLockDeps,
    private readonly config: RedisLockConfig,
  ) {
    this.prefix = this.normalizePrefix(this.config.keyspacePrefix)
  }

  async acquire(key: LockKey, opts: AcquireOptions): Promise<LockLease | null> {
    if (opts.signal?.aborted) return null

    const timeoutMs = opts.timeoutMs ?? this.config.defaultTimeoutMs

    assertValidTimeMs(timeoutMs, "AcquireOptions.timeoutMs")

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

  async tryAcquire(key: LockKey, opts: TryAcquireOptions): Promise<LockLease | null> {
    const redisKey = this.formatKey(key)
    const token = this.deps.generateToken()

    const res = await this.deps.client.set(redisKey, token, {
      NX: true,
      PX: opts.ttl.milliseconds,
    })

    if (res !== "OK") return null

    return new RedisLease(key, { redisKey, token, client: this.deps.client })
  }

  private normalizePrefix(prefix: string): string {
    return prefix.endsWith(":") ? prefix : `${prefix}:`
  }

  private formatKey(key: LockKey): string {
    return `${this.prefix}${key}`
  }
}
