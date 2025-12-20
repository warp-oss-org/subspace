import type { Milliseconds, Seconds } from "./time"

type SecondsTtl = { kind: "seconds"; seconds: Seconds }
type MillisecondsTtl = { kind: "milliseconds"; milliseconds: Milliseconds }
type UntilDateTtl = { kind: "until"; expiresAt: Date }

export type CacheTtl = SecondsTtl | MillisecondsTtl | UntilDateTtl

export type CacheSetOptions = {
  ttl: CacheTtl

  /**
   * Optional tag(s) for more coarse invalidation strategies.
   */
  tags: readonly string[]
}

export type CacheGetOptions = {
  /**
   * Allow returning stale values if the adapter supports it (e.g., stale-while-revalidate).
   *
   * Default: `false`.
   */
  allowStale: boolean
}

export type CacheInvalidateOptions = {
  tags: readonly string[]
}
