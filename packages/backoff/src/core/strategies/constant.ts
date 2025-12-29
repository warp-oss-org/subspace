import type { Delay, DelayPolicy } from "../../ports/delay-policy"

export interface ConstantOptions {
  /** Fixed delay between attempts */
  delay: Delay
}

export function constant(options: ConstantOptions): DelayPolicy {
  const { delay } = options

  return {
    getDelay(_attempt: number): Delay {
      return { milliseconds: delay.milliseconds }
    },
  }
}
