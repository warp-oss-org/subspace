import { pollUntil } from "../../../core/polling/poll-until"
import { sleep } from "../../../core/polling/sleep"
import { SystemClock } from "../../../core/time/clock"
import { createPgTestPool } from "../../../test/utils/create-postgres-test-client"
import { hashLockKeyInt64 } from "../hashLockKeyInt64"
import { PostgresAdvisoryLock } from "../postgres-advisory-lock"

describe("PostgresAdvisoryLock integration", () => {
  const { pool } = createPgTestPool()

  beforeAll(async () => {
    const client = await pool.connect()
    client.release()
  })

  afterAll(async () => {
    await pool.end()
  })

  it("releases the lock when the connection is closed", async () => {
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
        defaultTimeoutMs: 500,
        pollMs: 10,
      },
    )

    const key = "integration:connection-drop"

    const lease = await lock.tryAcquire(key, {
      ttl: { milliseconds: 5_000 },
    })

    expect(lease).not.toBeNull()
    await lease!.release()

    const reacquired = await lock.tryAcquire(key, {
      ttl: { milliseconds: 5_000 },
    })

    expect(reacquired).not.toBeNull()
    await reacquired!.release()
  })
})
