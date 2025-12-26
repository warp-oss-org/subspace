import { ManualTestClock } from "../../../tests/utils/manual-test-clock"
import type { PollUntilResult } from "../poll-until"
import { pollUntil } from "../poll-until"
import type { Sleep } from "../sleep"

function makeFakeSleep(clock: ManualTestClock): Sleep {
  return vi.fn(async (ms: number) => {
    clock.advanceMs(ms)
  })
}

describe("pollUntil", () => {
  it("returns success immediately when fn returns a value on first attempt", async () => {
    const clock = new ManualTestClock(new Date(0))
    const sleep = makeFakeSleep(clock)

    const fn = vi.fn(async () => "ok")

    const res = await pollUntil(fn, { clock, sleep }, { pollMs: 10, timeoutMs: 100 })

    expect(res).toEqual<PollUntilResult<string>>({ ok: true, value: "ok" })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it("polls until fn returns a value", async () => {
    const clock = new ManualTestClock(new Date(0))
    const sleep = makeFakeSleep(clock)

    const fn = vi
      .fn(async (): Promise<string | null> => null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("done")

    const res = await pollUntil(fn, { clock, sleep }, { pollMs: 10, timeoutMs: 100 })

    expect(res).toEqual<PollUntilResult<string>>({ ok: true, value: "done" })
    expect(fn).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it("returns timeout failure when deadline elapses", async () => {
    const clock = new ManualTestClock(new Date(0))
    const sleep = makeFakeSleep(clock)

    const fn = vi.fn(async () => null)

    const res = await pollUntil(fn, { clock, sleep }, { pollMs: 10, timeoutMs: 25 })

    expect(res).toEqual<PollUntilResult<never>>({ ok: false, reason: "timeout" })
    expect(fn).toHaveBeenCalled()
  })

  it("returns aborted failure when signal is aborted before first attempt", async () => {
    const clock = new ManualTestClock(new Date(0))
    const sleep = makeFakeSleep(clock)

    const ac = new AbortController()
    ac.abort()

    const fn = vi.fn(async () => "should-not-run")

    const res = await pollUntil(
      fn,
      { clock, sleep },
      {
        pollMs: 10,
        timeoutMs: 100,
        signal: ac.signal,
      },
    )

    expect(res).toEqual<PollUntilResult<never>>({ ok: false, reason: "aborted" })
    expect(fn).not.toHaveBeenCalled()
    expect(sleep).not.toHaveBeenCalled()
  })

  it("returns aborted failure when signal is aborted mid-poll", async () => {
    const clock = new ManualTestClock(new Date(0))
    const sleep = makeFakeSleep(clock)

    const ac = new AbortController()

    const fn = vi.fn(async () => {
      if (clock.nowMs() >= 10) ac.abort()
      return null
    })

    const res = await pollUntil(
      fn,
      { clock, sleep },
      {
        pollMs: 10,
        timeoutMs: 100,
        signal: ac.signal,
      },
    )

    expect(res).toEqual<PollUntilResult<never>>({ ok: false, reason: "aborted" })
    expect(fn).toHaveBeenCalled()
  })

  it("sleeps pollMs between attempts", async () => {
    const clock = new ManualTestClock(new Date(0))
    const sleep = makeFakeSleep(clock)

    const fn = vi.fn(async () => null)

    await pollUntil(fn, { clock, sleep }, { pollMs: 10, timeoutMs: 30 })

    expect(sleep).toHaveBeenCalledWith(10, undefined)
  })

  it("does not poll after success", async () => {
    const clock = new ManualTestClock(new Date(0))
    const sleep = makeFakeSleep(clock)

    const fn = vi.fn(async () => "ok")

    await pollUntil(fn, { clock, sleep }, { pollMs: 10, timeoutMs: 100 })

    expect(fn).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it("does not poll after timeout", async () => {
    const clock = new ManualTestClock(new Date(0))
    const sleep = makeFakeSleep(clock)

    const fn = vi.fn(async () => null)

    await pollUntil(fn, { clock, sleep }, { pollMs: 10, timeoutMs: 10 })

    expect(clock.nowMs()).toBeGreaterThanOrEqual(10)
  })

  it("does not poll after abort", async () => {
    const clock = new ManualTestClock(new Date(0))
    const sleep = makeFakeSleep(clock)

    const ac = new AbortController()
    ac.abort()

    const fn = vi.fn(async () => null)

    await pollUntil(
      fn,
      { clock, sleep },
      {
        pollMs: 10,
        timeoutMs: 100,
        signal: ac.signal,
      },
    )

    expect(fn).not.toHaveBeenCalled()
    expect(sleep).not.toHaveBeenCalled()
  })
})
