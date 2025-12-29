import type { Delay } from "./delay-policy"

/**
 * Adds randomness to prevent thundering herd.
 * Implementations should return non-negative numbers but are not trusted.
 */
export interface JitterStrategy {
  apply(delay: Delay): Delay
}
