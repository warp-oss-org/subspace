import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { pollUntil } from "../../../core/polling/poll-until"
import { sleep } from "../../../core/polling/sleep"
import { SystemClock } from "../../../core/time/clock"
import { createRedisTestClient } from "../../../tests/utils/create-redis-test-client"
import { RedisLock } from "../redis-lock"

describe("RedisLock behavior", () => {
  const { client } = createRedisTestClient()

  beforeAll(async () => {
    await client.connect()
  })

  afterAll(async () => {
    await client.quit()
  })

  describe("token safety", () => {
    it("release does not delete the key if token mismatches", async () => {
      const key = "mismatch-release"
      const prefix = "behavior:token:"
      const redisKey = `${prefix}:${key}`

      const lock = new RedisLock(
        {
          client,
          clock: new SystemClock(),
          sleep,
          pollUntil,
          generateToken: () => crypto.randomUUID(),
        },
        {
          defaultTimeoutMs: 100,
          pollMs: 10,
          keyspacePrefix: prefix,
        },
      )

      const lease = await lock.tryAcquire(key, {
        ttl: { milliseconds: 5_000 },
      })
      expect(lease).not.toBeNull()

      await client.set(redisKey, "stolen-token", { PX: 5_000 })

      await lease!.release()

      const value = await client.get(redisKey)
      expect(value).toBe("stolen-token")

      await client.del(redisKey)
    })

    it("extend returns false if token mismatches", async () => {
      const key = "mismatch-extend"
      const prefix = "behavior:token:"
      const redisKey = `${prefix}:${key}`

      const lock = new RedisLock(
        {
          client,
          clock: new SystemClock(),
          sleep,
          pollUntil,
          generateToken: () => crypto.randomUUID(),
        },
        {
          defaultTimeoutMs: 100,
          pollMs: 10,
          keyspacePrefix: prefix,
        },
      )

      const lease = await lock.tryAcquire(key, {
        ttl: { milliseconds: 5_000 },
      })
      expect(lease).not.toBeNull()

      await client.set(redisKey, "stolen-token", { PX: 5_000 })

      const ok = await lease!.extend({ milliseconds: 5_000 })
      expect(ok).toBe(false)

      await client.del(redisKey)
    })
  })

  describe("key formatting", () => {
    it("prefixes keys with keyspacePrefix", async () => {
      const prefix = "behavior:prefix:"
      const key = "formatted"

      const lock = new RedisLock(
        {
          client,
          clock: new SystemClock(),
          sleep,
          pollUntil,
          generateToken: () => crypto.randomUUID(),
        },
        {
          defaultTimeoutMs: 100,
          pollMs: 10,
          keyspacePrefix: prefix,
        },
      )

      const lease = await lock.tryAcquire(key, {
        ttl: { milliseconds: 5_000 },
      })
      expect(lease).not.toBeNull()

      const res = await client.eval("return redis.call('GET', KEYS[1])", {
        keys: [`${prefix}:${key}`],
        arguments: [],
      })

      expect(res).not.toBeNull()

      await lease!.release()
    })
  })
})
