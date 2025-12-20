import type { Milliseconds, Seconds } from "./time"

type SecondsTtl = { kind: "seconds"; seconds: Seconds }
type MillisecondsTtl = { kind: "milliseconds"; milliseconds: Milliseconds }
type UntilDateTtl = { kind: "until"; expiresAt: Date }

export type CacheTtl = SecondsTtl | MillisecondsTtl | UntilDateTtl

export type CacheSetOptions = {
  ttl: CacheTtl
}
