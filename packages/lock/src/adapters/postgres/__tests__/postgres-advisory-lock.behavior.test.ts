import { describe, expect, it } from "vitest"
import {
  hashLockKeyInt64,
  POSTGRES_INT64_MAX,
  POSTGRES_INT64_MIN,
} from "../hashLockKeyInt64"

describe("PostgresAdvisoryLock behavior", () => {
  describe("key hashing", () => {
    it("produces a signed int64 bigint within Postgres range", () => {
      const keys = [
        "a",
        "contract:mutex",
        "user:123:checkout",
        "very:long:key:" + "x".repeat(512),
        "unicode:🔒:ключ:鍵",
      ]

      for (const k of keys) {
        const id = hashLockKeyInt64(k)

        expect(typeof id).toBe("bigint")
        expect(id >= POSTGRES_INT64_MIN).toBe(true)
        expect(id <= POSTGRES_INT64_MAX).toBe(true)
      }
    })

    it("is stable for the same key", () => {
      const key = "stable:key:hashing"
      const a = hashLockKeyInt64(key)
      const b = hashLockKeyInt64(key)
      const c = hashLockKeyInt64(key)

      expect(a).toBe(b)
      expect(b).toBe(c)
    })
  })

  it("produces distinct hashes for different keys", () => {
    const keys = ["key:1", "key:2", "key:3", "user:a", "user:b"]
    const hashes = keys.map(hashLockKeyInt64)
    const unique = new Set(hashes)

    expect(unique.size).toBe(keys.length)
  })
})
