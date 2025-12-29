/**
 * Source of randomness.
 *
 * @remarks
 * `next()` MUST return a floating-point number in the range [0, 1).
 * Implementations should be side-effect free and thread-safe.
 */
export interface RandomSource {
  next(): number
}
