import { createHash } from "node:crypto"

const POSTGRES_INT64_MAX = 9223372036854775807n
const POSTGRES_INT64_MIN = -9223372036854775808n

/**
 * Hash a lock key to a signed 64-bit integer suitable for pg_advisory_lock.
 *
 * Uses SHA-256 truncated to 64 bits, interpreted as signed big-endian.
 */
export function hashLockKeyInt64(key: string): bigint {
  const hash = createHash("sha256").update(key, "utf8").digest()

  const unsigned = hash.readBigUInt64BE(0)

  const signed =
    unsigned > POSTGRES_INT64_MAX ? unsigned - 0x10000000000000000n : unsigned

  return signed
}

export { POSTGRES_INT64_MAX, POSTGRES_INT64_MIN }
