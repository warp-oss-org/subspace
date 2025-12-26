import { pollUntil } from "../../../core/polling/poll-until"
import { sleep } from "../../../core/polling/sleep"
import { SystemClock } from "../../../core/time/clock"
import { describeLockContract } from "../../../ports/__tests__/lock.contract"
import type { LockTtl } from "../../../ports/options"
import { createPgTestPool } from "../../../test/utils/create-postgres-test-client"
import { PostgresAdvisoryLock } from "../postgres-advisory-lock"

describe("PostgresAdvisoryLock contract", () => {
  const { pool } = createPgTestPool()

  beforeAll(async () => {
    const client = await pool.connect()
    client.release()
  })

  afterAll(async () => {
    await pool.end()
  })

  describeLockContract({
    name: "PostgresAdvisoryLock",
    ttl: (): LockTtl => ({ milliseconds: 5_000 }),

    async make() {
      const INT64_MAX = 2n ** 63n - 1n

      const lock = new PostgresAdvisoryLock(
        {
          leaseClient: async () => {
            const client = await pool.connect()
            return {
              client,
              release: async () => client.release(),
            }
          },
          clock: new SystemClock(),
          sleep,
          pollUntil,
          hashKey: (key) => {
            let hash = 0n
            for (let i = 0; i < key.length; i++) {
              hash = (hash << 5n) - hash + BigInt(key.charCodeAt(i))
              hash &= INT64_MAX
            }
            return hash
          },
        },
        {
          defaultTimeoutMs: 250,
          pollMs: 10,
        },
      )

      return {
        lock,
      }
    },
  })
})
