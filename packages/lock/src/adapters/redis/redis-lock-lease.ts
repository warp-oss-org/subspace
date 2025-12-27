import { assertValidTimeMs } from "../../core/validation/validation"
import type { LockKey } from "../../ports/lock"
import type { LockLease } from "../../ports/lock-lease"
import type { LockTtl } from "../../ports/options"
import type { Milliseconds } from "../../ports/time"
import type { RedisClient } from "./redis-client"

type RedisLockToken = string

type RedisLeaseDeps = {
  redisKey: LockKey
  token: RedisLockToken
  client: RedisClient
}

export class RedisLease implements LockLease {
  public readonly key: LockKey

  private released = false

  public constructor(
    key: LockKey,
    private readonly deps: RedisLeaseDeps,
  ) {
    this.key = key
  }

  async release(): Promise<void> {
    if (this.released) return

    this.released = true

    await this.deps.client.eval(this.releaseScript(), {
      keys: [this.deps.redisKey],
      arguments: [this.deps.token],
    })
  }

  async extend(ttl: LockTtl): Promise<boolean> {
    if (this.released) return false

    const ttlMs = this.ttlToMs(this.key, ttl)

    const res = await this.deps.client.eval(this.extendScript(), {
      keys: [this.deps.redisKey],
      arguments: [this.deps.token, String(ttlMs)],
    })

    return Number(res) === 1
  }

  private releaseScript(): string {
    return `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      end
      return 0
    `
  }

  private extendScript(): string {
    return `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("PEXPIRE", KEYS[1], ARGV[2])
      end
      return 0
    `
  }

  private ttlToMs(key: LockKey, ttl: LockTtl): Milliseconds {
    assertValidTimeMs(ttl.milliseconds, `ttl for lock ${key}`)

    return ttl.milliseconds
  }
}
