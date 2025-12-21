import type { Milliseconds } from "../../ports/time"

export interface Clock {
  now(): Date
  nowMs(): Milliseconds
}

export class SystemClock implements Clock {
  nowMs(): number {
    return Date.now()
  }

  now(): Date {
    return new Date()
  }
}
