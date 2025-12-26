import { pollUntil } from "../../../core/polling/poll-until"
import { sleep } from "../../../core/polling/sleep"
import { SystemClock } from "../../../core/time/clock"
import { describeLockContract } from "../../../ports/__tests__/lock.contract"
import type { LockTtl } from "../../../ports/options"
import { createRedisClient } from "../redis-client"
import { RedisLock } from "../redis-lock"

describe("RedisLock contract", () => {
  const client = createRedisClient({
    url: process.env.REDIS_URL ?? "redis://localhost:16380",
  })

  beforeAll(async () => {
    await client.connect()
  })

  afterAll(async () => {
    await client.quit()
  })

  describeLockContract({
    name: "RedisLock",
    ttl: (): LockTtl => ({ milliseconds: 5_000 }),

    async make() {
      const lock = new RedisLock(
        {
          client,
          clock: new SystemClock(),
          generateToken: () => crypto.randomUUID(),
          sleep,
          pollUntil,
        },
        {
          defaultTimeoutMs: 250,
          pollMs: 10,
          keyspacePrefix: "test:lock:",
        },
      )

      return { lock }
    },
  })
})
