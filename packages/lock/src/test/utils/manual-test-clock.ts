import type { Clock } from "../../core/time/clock"
import type { Milliseconds } from "../../ports/time"

export class ManualTestClock implements Clock {
  public constructor(private nowDate: Date) {}

  public nowMs(): Milliseconds {
    return this.nowDate.getTime()
  }

  public now(): Date {
    return this.nowDate
  }

  public advanceMs(ms: number): void {
    this.nowDate = new Date(this.nowDate.getTime() + ms)
  }
}
