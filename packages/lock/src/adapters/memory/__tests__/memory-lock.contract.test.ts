import { pollUntil } from "../../../core/polling/poll-until"
import { sleep } from "../../../core/polling/sleep"
import { SystemClock } from "../../../core/time/clock"
import { describeLockContract } from "../../../ports/__tests__/lock.contract"
import type { LockTtl } from "../../../ports/options"
import { MemoryLock } from "../memory-lock"

describe("MemoryLock contract", () => {
  const defaultTimeoutMs = 250

  describeLockContract({
    name: "MemoryLock",
    ttl: (): LockTtl => ({ milliseconds: 5_000 }),
    defaultTimeoutMs: (): number => defaultTimeoutMs,

    async make() {
      const lock = new MemoryLock(
        {
          clock: new SystemClock(),
          sleep,
          pollUntil,
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
