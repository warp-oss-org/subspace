import crypto from "node:crypto"
import { pollUntil } from "../../../core/polling/poll-until"
import { sleep } from "../../../core/polling/sleep"
import { SystemClock } from "../../../core/time/clock"
import { createRedisTestClient } from "../../../tests/utils/create-redis-test-client"
import { RedisLock } from "../redis-lock"

const delay = (n: number) => new Promise<void>((r) => setTimeout(r, n))

describe("RedisLock integration", () => {
  const { client } = createRedisTestClient()

  beforeAll(async () => {
    await client.connect()
  })

  afterAll(async () => {
    await client.quit()
  })

  it("token mismatch: stolen lock cannot be released by original holder", async () => {
    const prefix = "integration:token:"
    const key = "stolen-release"
    const redisKey = `${prefix}${key}`

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

    const lease = await lock.tryAcquire(key, { ttl: { milliseconds: 5_000 } })

    expect(lease).not.toBeNull()

    await client.set(redisKey, "stolen-token", { PX: 5_000 })

    await lease!.release()

    const value = await client.eval("return redis.call('GET', KEYS[1])", {
      keys: [redisKey],
      arguments: [],
    })

    expect(value).toBe("stolen-token")

    await client.eval("return redis.call('DEL', KEYS[1])", {
      keys: [redisKey],
      arguments: [],
    })
  })

  it("token mismatch: extend fails if another client stole the lock", async () => {
    const prefix = "integration:token:"
    const key = "stolen-extend"
    const redisKey = `${prefix}${key}`

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

    const lease = await lock.tryAcquire(key, { ttl: { milliseconds: 5_000 } })
    expect(lease).not.toBeNull()

    await client.set(redisKey, "stolen-token", { PX: 5_000 })

    const ok = await lease!.extend({ milliseconds: 5_000 })
    expect(ok).toBe(false)

    await client.eval("return redis.call('DEL', KEYS[1])", {
      keys: [redisKey],
      arguments: [],
    })
  })

  it("TTL is enforced server-side (not just client watchdog)", async () => {
    const prefix = "integration:ttl:"
    const key = "server-ttl"
    const redisKey = `${prefix}${key}`

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

    const lease = await lock.tryAcquire(key, { ttl: { milliseconds: 75 } })
    expect(lease).not.toBeNull()

    await delay(150)

    const exists = await client.eval("return redis.call('EXISTS', KEYS[1])", {
      keys: [redisKey],
      arguments: [],
    })

    expect(Number(exists)).toBe(0)

    const reacquired = await lock.tryAcquire(key, { ttl: { milliseconds: 5_000 } })

    expect(reacquired).not.toBeNull()

    await reacquired!.release()
  })
})
