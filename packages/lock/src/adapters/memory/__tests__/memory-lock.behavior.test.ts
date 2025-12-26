import { pollUntil } from "../../../core/polling/poll-until"
import { sleep } from "../../../core/polling/sleep"
import { SystemClock } from "../../../core/time/clock"
import { MemoryLock } from "../memory-lock"

describe("MemoryLock behavior", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("TTL watchdog does not keep the process alive (timer unref)", async () => {
    const unref = vi.fn()

    const setTimeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockReturnValueOnce({ unref } as any)

    const lock = new MemoryLock(
      { clock: new SystemClock(), sleep, pollUntil },
      { defaultTimeoutMs: 250, pollMs: 10 },
    )

    const lease = await lock.tryAcquire("behavior:unref", {
      ttl: { milliseconds: 5_000 },
    })

    expect(lease).not.toBeNull()

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1)
    expect(unref).toHaveBeenCalledTimes(1)

    await lease!.release()
  })
})
