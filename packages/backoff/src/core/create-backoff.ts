import type { Delay, DelayPolicy } from "../ports/delay-policy"
import type { JitterStrategy } from "../ports/jitter-strategy"

function sanitize(ms: number, fallback: number): number {
  return Number.isFinite(ms) && ms >= 0 ? ms : fallback
}

function clamp(ms: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, ms))
}

function validateBounds(min: Delay, max: Delay): { minMs: number; maxMs: number } {
  const minMs = min.milliseconds
  const maxMs = max.milliseconds

  if (!Number.isFinite(minMs) || minMs < 0) {
    throw new RangeError(`min.milliseconds must be finite and >= 0 (got ${minMs})`)
  }

  if (!Number.isFinite(maxMs) || maxMs < 0) {
    throw new RangeError(`max.milliseconds must be finite and >= 0 (got ${maxMs})`)
  }

  if (maxMs < minMs) {
    throw new RangeError(
      `max.milliseconds must be >= min.milliseconds (got ${maxMs} < ${minMs})`,
    )
  }

  return { minMs, maxMs }
}

export type CreateBackoffOptions = {
  delay: DelayPolicy
  jitter?: JitterStrategy

  /** Floor for delay. Must be finite, non-negative. */
  min: Delay

  /** Ceiling for delay. Must be finite, non-negative, >= min. */
  max: Delay
}

export type CreateBackoffFn = (options: CreateBackoffOptions) => DelayPolicy

/**
 * Creates a DelayPolicy with clamping and sanitization.
 * Guarantees finite, non-negative, clamped output.
 */
export const createBackoff: CreateBackoffFn = (
  options: CreateBackoffOptions,
): DelayPolicy => {
  const { delay, jitter, min, max } = options

  const { minMs, maxMs } = validateBounds(min, max)

  return {
    getDelay(attempt: number): Delay {
      const raw = delay.getDelay(attempt)
      const jittered = jitter ? jitter.apply(raw) : raw
      const sanitized = sanitize(jittered.milliseconds, minMs)
      const clamped = clamp(sanitized, minMs, maxMs)

      return { milliseconds: Math.floor(clamped) }
    },
  }
}
