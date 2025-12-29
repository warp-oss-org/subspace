import { systemRandom } from "../../adapters/random"
import type { Delay } from "../../ports/delay-policy"
import type { JitterStrategy } from "../../ports/jitter-strategy"
import type { RandomSource } from "../../ports/random-source"

/**
 * Full jitter: random value between 0 and delay.
 * Provides maximum spread to de-correlate retries.
 */
export function fullJitter(random: RandomSource = systemRandom): JitterStrategy {
  return {
    apply(delay: Delay): Delay {
      return {
        milliseconds: Math.floor(random.next() * (delay.milliseconds + 1)),
      }
    },
  }
}
