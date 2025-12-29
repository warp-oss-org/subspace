import type { Delay } from "../../ports/delay-policy"

export interface LinearOptions {
  base: Delay

  /** Amount to add per attempt */
  increment: Delay
}

export function linear(opts: LinearOptions) {
  const { base, increment } = opts

  return {
    getDelay(attempt: number): Delay {
      return {
        milliseconds: base.milliseconds + increment.milliseconds * attempt,
      }
    },
  }
}
