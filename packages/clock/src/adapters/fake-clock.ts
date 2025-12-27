import type { Clock } from "../ports/clock"
import type { Milliseconds } from "../ports/time"

export class FakeClock implements Clock {
  private time: Milliseconds

  constructor(start: Milliseconds = 0) {
    this.time = start
  }

  now(): Date {
    return new Date(this.time)
  }

  nowMs(): Milliseconds {
    return this.time
  }

  advance(ms: Milliseconds): void {
    this.time = this.time + ms
  }

  set(ms: Milliseconds): void {
    this.time = ms
  }

  /** Sleep resolves immediately (no timers). */
  async sleep(_ms: Milliseconds, _signal?: AbortSignal): Promise<void> {}
}
