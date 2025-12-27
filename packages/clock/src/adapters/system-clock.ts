import type { Clock } from "../ports/clock"
import type { Milliseconds } from "../ports/time"

export class SystemClock implements Clock {
  now(): Date {
    return new Date()
  }

  nowMs(): Milliseconds {
    return Date.now()
  }

  sleep(ms: Milliseconds, signal?: AbortSignal): Promise<void> {
    if (ms <= 0) return Promise.resolve()
    if (signal?.aborted) return Promise.resolve()

    return new Promise((resolve) => {
      const onAbort = () => {
        clearTimeout(timer)
        resolve()
      }

      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort)
        resolve()
      }, ms)

      signal?.addEventListener("abort", onAbort, { once: true })
    })
  }
}
