import { systemRandom } from "../../adapters/random"
import type { Delay } from "../../ports/delay-policy"
import type { JitterStrategy } from "../../ports/jitter-strategy"
import type { RandomSource } from "../../ports/random-source"

export interface DecorrelatedJitterOptions {
  /** Minimum delay floor */
  min: Delay
}

/**
 * Decorrelated jitter: random value between `min` and `delay * 3`.
 *
 * Stateless variant — each application is independent.
 */
export function decorrelatedJitter(
  options: DecorrelatedJitterOptions,
  random: RandomSource = systemRandom,
): JitterStrategy {
  const minMs = options.min.milliseconds

  return {
    apply(delay: Delay): Delay {
      const ceiling = delay.milliseconds * 3

      return {
        milliseconds: Math.floor(minMs + random.next() * (ceiling - minMs)),
      }
    },
  }
}
