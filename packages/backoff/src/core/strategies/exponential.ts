import type { Delay, DelayPolicy } from "../../ports/delay-policy"

export interface ExponentialOptions {
  base: Delay

  /** Multiplier per attempt. Default: 2 */
  factor?: number
}

export function exponential(opts: ExponentialOptions): DelayPolicy {
  const { base, factor = 2 } = opts

  return {
    getDelay(attempt: number): Delay {
      return { milliseconds: base.milliseconds * factor ** attempt }
    },
  }
}
