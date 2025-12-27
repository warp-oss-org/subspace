import { pollUntil } from "../../../core/polling/poll-until"
import { sleep } from "../../../core/polling/sleep"
import { SystemClock } from "../../../core/time/clock"
import { describeLockContract } from "../../../ports/__tests__/lock.contract"
import type { LockTtl } from "../../../ports/options"
import type { Milliseconds } from "../../../ports/time"
import { createPgTestPool } from "../../../tests/utils/create-postgres-test-client"
import { hashLockKeyInt64 } from "../hashLockKeyInt64"
import { PostgresAdvisoryLock } from "../postgres-advisory-lock"

describe("PostgresAdvisoryLock contract", () => {
  const defaultTimeoutMs = 250
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
    defaultTimeoutMs: (): Milliseconds => defaultTimeoutMs,

    async make() {
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
          hashKey: hashLockKeyInt64,
        },
        {
          defaultTimeoutMs,
          pollMs: 10,
        },
      )

      return { lock }
    },
  })
})
