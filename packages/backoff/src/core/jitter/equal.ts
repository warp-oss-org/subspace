import { systemRandom } from "../../adapters/random"
import type { Delay } from "../../ports/delay-policy"
import type { JitterStrategy } from "../../ports/jitter-strategy"
import type { RandomSource } from "../../ports/random-source"

/**
 * Equal jitter: half the delay plus a random value up to the other half.
 * Guarantees at least 50% of the base delay.
 *
 * Range (integer ms): [floor(0.5 * base), base]
 */
export function equalJitter(random: RandomSource = systemRandom): JitterStrategy {
  return {
    apply(delay: Delay): Delay {
      const half = Math.floor(delay.milliseconds / 2)
      const jitter = Math.floor(random.next() * (half + 1))

      return { milliseconds: half + jitter }
    },
  }
}
