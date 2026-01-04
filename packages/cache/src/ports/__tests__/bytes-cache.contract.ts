import { beforeEach, describe, expect, it } from "vitest"
import { bytes, entry, keys } from "../../tests/utils/cache-test-helpers"
import { expectMapEntries } from "../../tests/utils/expect-map-entries"
import { SLOW_TEST_TAG, sleep } from "../../tests/utils/sleep"
import type { BytesCache } from "../bytes-cache"
import type { CacheEntry } from "../cache-entry"

type CreateBytesCache = () => BytesCache

export function describeCacheContract(
  adapterName: string,
  createCache: CreateBytesCache,
): void {
  describe(`BytesCache Contract Tests - ${adapterName}`, () => {
    const jitterMs = 50

    let cache: BytesCache

    beforeEach(() => {
      cache = createCache()
    })

    describe("sanity", () => {
      it("creates a cache instance", () => {
        const instance = createCache()

        expect(instance).toBeDefined()
      })

      it("supports being created multiple times (independent instances)", () => {
        const cache1 = createCache()
        const cache2 = createCache()

        expect(cache1).toBeDefined()
        expect(cache2).toBeDefined()
        expect(cache1).not.toBe(cache2)
      })
    })

    describe("get/set basic semantics", () => {
      it("returns miss when key is absent", async () => {
        const res = await cache.get("missing")

        expect(res).toStrictEqual({ kind: "miss" })
      })

      it("returns hit after set with the same bytes that were set (byte-for-byte)", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        await cache.set(key, value)

        const res = await cache.get(key)

        expect(res).toStrictEqual({ kind: "hit", value })
      })

      it("overwriting an existing key updates the stored value", async () => {
        const [key, value1] = entry(keys.one(), bytes.a())
        const value2 = bytes.b()

        await cache.set(key, value1)
        await cache.set(key, value2)

        const res = await cache.get(key)

        expect(res).toStrictEqual({ kind: "hit", value: value2 })
      })

      it("set does not mutate the input Uint8Array", async () => {
        const [key, value] = entry(keys.one(), bytes.a())
        const snapshot = value.slice()

        await cache.set(key, value)

        expect(value).toStrictEqual(snapshot)
      })
    })

    describe("invalidate semantics", () => {
      it("invalidate on absent key is a no-op (does not throw)", async () => {
        await cache.invalidate("missing")
      })

      it("invalidate removes an existing key (subsequent get is miss)", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        await cache.set(key, value)

        await cache.invalidate(key)

        const res = await cache.get(key)

        expect(res).toStrictEqual({ kind: "miss" })
      })

      it("invalidate is idempotent (calling twice is safe)", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        await cache.set(key, value)

        await cache.invalidate(key)
        await cache.invalidate(key)

        const res = await cache.get(key)

        expect(res).toStrictEqual({ kind: "miss" })
      })
    })

    describe("getMany semantics", () => {
      it("getMany([]) returns an empty Map", async () => {
        const res = await cache.getMany([])

        expect(res).toStrictEqual(new Map())
      })

      it("getMany preserves key identity: Map keys are the provided CacheKey values", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())
        const [key3, value3] = entry(keys.three(), bytes.empty())

        await cache.set(key1, value1)
        await cache.set(key2, value2)
        await cache.set(key3, value3)

        const res = await cache.getMany([key1, key2, key3])

        expectMapEntries(res, [
          [key1, { kind: "hit", value: value1 }],
          [key2, { kind: "hit", value: value2 }],
          [key3, { kind: "hit", value: value3 }],
        ])
      })

      it("getMany returns miss for absent keys", async () => {
        const [key1, key2] = ["missing1", "missing2"]

        const res = await cache.getMany([key1, key2])

        expectMapEntries(res, [
          [key1, { kind: "miss" }],
          [key2, { kind: "miss" }],
        ])
      })

      it("getMany returns hit for present keys", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())

        await cache.set(key1, value1)
        await cache.set(key2, value2)

        const res = await cache.getMany([key1, "missing", key2])

        expectMapEntries(res, [
          [key1, { kind: "hit", value: value1 }],
          ["missing", { kind: "miss" }],
          [key2, { kind: "hit", value: value2 }],
        ])
      })

      it("getMany returns results aligned to input keys (no mixing)", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())

        await cache.set(key1, value1)
        await cache.set(key2, value2)

        const res = await cache.getMany([key2, "missing", key1])

        expectMapEntries(res, [
          [key2, { kind: "hit", value: value2 }],
          ["missing", { kind: "miss" }],
          [key1, { kind: "hit", value: value1 }],
        ])
      })

      it("getMany works when some keys are hits and some are misses", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())

        await cache.set(key1, value1)

        const res = await cache.getMany([key1, "missing1", "missing2"])

        expectMapEntries(res, [
          [key1, { kind: "hit", value: value1 }],
          ["missing1", { kind: "miss" }],
          ["missing2", { kind: "miss" }],
        ])
      })

      it("getMany de-dupes duplicate keys, preserving the order of first occurrence", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())

        await cache.set(key1, value1)
        await cache.set(key2, value2)

        const res = await cache.getMany([key2, key1, key2, "missing", key1])

        expectMapEntries(res, [
          [key2, { kind: "hit", value: value2 }],
          [key1, { kind: "hit", value: value1 }],
          ["missing", { kind: "miss" }],
        ])
      })
    })

    describe("setMany semantics", () => {
      it("setMany([]) is a no-op (does not throw)", async () => {
        await cache.setMany([])
      })

      it("setMany writes all provided entries", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())
        const [key3, value3] = entry(keys.three(), bytes.empty())

        await cache.setMany([
          [key1, value1],
          [key2, value2],
          [key3, value3],
        ])

        const res = await cache.getMany([key1, key2, key3])

        expectMapEntries(res, [
          [key1, { kind: "hit", value: value1 }],
          [key2, { kind: "hit", value: value2 }],
          [key3, { kind: "hit", value: value3 }],
        ])
      })

      it("setMany overwrites existing keys when provided", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const value2 = bytes.b()

        await cache.set(key1, value1)

        await cache.setMany([[key1, value2]])

        const res = await cache.get(key1)

        expect(res).toStrictEqual({ kind: "hit", value: value2 })
      })

      it("setMany accepts duplicate keys; last-write-wins for each duplicated key (matches sequential set behavior)", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const value2 = bytes.b()

        await cache.setMany([
          [key1, value1],
          [key1, value2],
        ])

        const res = await cache.get(key1)

        expect(res).toStrictEqual({ kind: "hit", value: value2 })
      })

      it("setMany does not mutate any input Uint8Array values", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())
        const snapshot1 = value1.slice()
        const snapshot2 = value2.slice()

        await cache.setMany([
          [key1, value1],
          [key2, value2],
        ])

        expect(value1).toStrictEqual(snapshot1)
        expect(value2).toStrictEqual(snapshot2)
      })
    })

    describe("invalidateMany semantics", () => {
      it("invalidateMany([]) is a no-op (does not throw)", async () => {
        await cache.invalidateMany([])
      })

      it("invalidateMany removes all provided keys", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())
        const [key3, value3] = entry(keys.three(), bytes.empty())

        await cache.set(key1, value1)
        await cache.set(key2, value2)
        await cache.set(key3, value3)

        await cache.invalidateMany([key1, key2, key3])

        const res = await cache.getMany([key1, key2, key3])

        expectMapEntries(res, [
          [key1, { kind: "miss" }],
          [key2, { kind: "miss" }],
          [key3, { kind: "miss" }],
        ])
      })

      it("invalidateMany is idempotent (safe to call repeatedly)", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())

        await cache.set(key1, value1)
        await cache.set(key2, value2)

        await cache.invalidateMany([key1, key2])
        await cache.invalidateMany([key1, key2])

        const res = await cache.getMany([key1, key2])

        expectMapEntries(res, [
          [key1, { kind: "miss" }],
          [key2, { kind: "miss" }],
        ])
      })

      it("invalidateMany ignores missing keys without throwing", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const key2 = "missing"

        await cache.set(key1, value1)

        await cache.invalidateMany([key1, key2])
      })

      it("invalidateMany accepts duplicate keys and behaves as if each key were invalidated once (idempotent)", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())

        await cache.set(key1, value1)

        await cache.invalidateMany([key1, key1, key1, "missing", "missing"])

        const res = await cache.get(key1)

        expect(res).toStrictEqual({ kind: "miss" })
      })
    })

    describe("interactions between many and single-key ops", () => {
      it("values set via set are visible via getMany", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())
        const [key3, value3] = entry(keys.three(), bytes.empty())

        await cache.set(key1, value1)
        await cache.set(key2, value2)
        await cache.set(key3, value3)

        const res = await cache.getMany([key1, key2, key3])

        expectMapEntries(res, [
          [key1, { kind: "hit", value: value1 }],
          [key2, { kind: "hit", value: value2 }],
          [key3, { kind: "hit", value: value3 }],
        ])
      })

      it("values set via setMany are visible via get", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())

        await cache.setMany([
          [key1, value1],
          [key2, value2],
        ])

        const res1 = await cache.get(key1)
        const res2 = await cache.get(key2)

        expect(res1).toStrictEqual({ kind: "hit", value: value1 })
        expect(res2).toStrictEqual({ kind: "hit", value: value2 })
      })

      it("invalidate affects getMany results", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())

        await cache.set(key1, value1)

        await cache.invalidate(key1)

        const res = await cache.getMany([key1])

        expectMapEntries(res, [[key1, { kind: "miss" }]])
      })

      it("invalidateMany affects get results", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())

        await cache.set(key1, value1)

        await cache.invalidateMany([key1])

        const res = await cache.get(key1)

        expect(res).toStrictEqual({ kind: "miss" })
      })
    })

    describe("TTL / expiration semantics", () => {
      it("supports setting TTL via set options", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        await cache.set(key, value, { ttl: { kind: "seconds", seconds: 60 } })

        const res = await cache.get(key)

        expect(res).toStrictEqual({ kind: "hit", value })
      })

      it("supports setting TTL via setMany options", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())

        await cache.setMany(
          [
            [key1, value1],
            [key2, value2],
          ],
          { ttl: { kind: "seconds", seconds: 60 } },
        )

        const res = await cache.getMany([key1, key2])

        expectMapEntries(res, [
          [key1, { kind: "hit", value: value1 }],
          [key2, { kind: "hit", value: value2 }],
        ])
      })

      it(`TTL kind: seconds — expires after the specified number of seconds ${SLOW_TEST_TAG}`, async () => {
        const ttlSeconds = 1
        await cache.set(keys.one(), bytes.a(), {
          ttl: { kind: "seconds", seconds: ttlSeconds },
        })

        await sleep(ttlSeconds * 1000 + jitterMs)

        const res = await cache.get(keys.one())

        expect(res).toStrictEqual({ kind: "miss" })
      })

      it("TTL kind: milliseconds — expires after the specified number of milliseconds", async () => {
        const ttlMilliseconds = 80

        await cache.set(keys.one(), bytes.a(), {
          ttl: { kind: "milliseconds", milliseconds: ttlMilliseconds },
        })

        await sleep(ttlMilliseconds + jitterMs)

        const res = await cache.get(keys.one())

        expect(res).toStrictEqual({ kind: "miss" })
      })

      it("TTL kind: until-date — expires at (or after) the specified Date", async () => {
        const ttlDurationMs = 80
        const expiresAt = new Date(Date.now() + ttlDurationMs)

        await cache.set(keys.one(), bytes.a(), { ttl: { kind: "until", expiresAt } })

        await sleep(ttlDurationMs + jitterMs)

        const res = await cache.get(keys.one())

        expect(res).toStrictEqual({ kind: "miss" })
      })

      it("entries expire after TTL elapses (hit becomes miss) when ttl is enabled", async () => {
        const ttlMilliseconds = 100

        const value = bytes.a()

        await cache.set(keys.one(), value, {
          ttl: { kind: "milliseconds", milliseconds: ttlMilliseconds },
        })

        const res1 = await cache.get(keys.one())

        expect(res1).toStrictEqual({ kind: "hit", value })

        await sleep(ttlMilliseconds + jitterMs)

        const res2 = await cache.get(keys.one())

        expect(res2).toStrictEqual({ kind: "miss" })
      })

      it("entries without TTL do not expire", async () => {
        const value = bytes.a()

        await cache.set(keys.one(), value)

        const res1 = await cache.get(keys.one())

        expect(res1).toStrictEqual({ kind: "hit", value })

        await sleep(150)

        const res2 = await cache.get(keys.one())

        expect(res2).toStrictEqual({ kind: "hit", value })
      })

      it("TTL overwrite: updating a key with new TTL replaces the old TTL", async () => {
        const oldTtlMilliseconds = 200
        const newTtlMilliseconds = 40

        const [key, value] = entry(keys.one(), bytes.a())

        await cache.set(key, value, {
          ttl: { kind: "milliseconds", milliseconds: oldTtlMilliseconds },
        })

        await cache.set(key, value, {
          ttl: { kind: "milliseconds", milliseconds: newTtlMilliseconds },
        })

        const res1 = await cache.get(key)
        expect(res1).toStrictEqual({ kind: "hit", value })

        await sleep(newTtlMilliseconds + jitterMs)

        const res2 = await cache.get(key)
        expect(res2).toStrictEqual({ kind: "miss" })
      })

      it("TTL overwrite: updating a key without TTL preserves existing TTL", async () => {
        const key = keys.one()
        const value = bytes.a()
        const ttlMilliseconds = 60

        await cache.set(key, value, {
          ttl: { kind: "milliseconds", milliseconds: ttlMilliseconds },
        })

        await cache.set(key, value)

        await sleep(Math.max(0, ttlMilliseconds - 20))

        const before = await cache.get(key)

        await sleep(40 + jitterMs)

        const after = await cache.get(key)

        expect(before).toStrictEqual({ kind: "hit", value })
        expect(after).toStrictEqual({ kind: "miss" })
      })

      it("invalidate works regardless of TTL state", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        await cache.set(key, value, { ttl: { kind: "seconds", seconds: 100 } })

        await cache.invalidate(key)

        const res = await cache.get(key)

        expect(res).toStrictEqual({ kind: "miss" })
      })
    })

    describe("edge cases & robustness", () => {
      it("handles empty Uint8Array values (length 0) correctly", async () => {
        const [key, value] = entry(keys.one(), bytes.empty())

        await cache.set(key, value)

        const res = await cache.get(key)

        expect(res).toStrictEqual({ kind: "hit", value })
      })

      it("handles values containing null bytes (0x00) correctly", async () => {
        const value = new Uint8Array([0, 0, 0])
        const [key] = entry(keys.one(), value)

        await cache.set(key, value)

        const res = await cache.get(key)

        expect(res).toStrictEqual({ kind: "hit", value })
      })

      it("handles large values (within adapter limits) correctly", async () => {
        const value = new Uint8Array(1 * 1024 * 1024)
        value[0] = 1
        value[value.length - 1] = 2

        const [key] = entry("largeKey", value)

        await cache.set(key, value)

        const res = await cache.get(key)

        expect(res.kind).toBe("hit")
        if (res.kind !== "hit") return

        expect(res.value.byteLength).toBe(value.byteLength)
        expect(res.value[0]).toBe(1)
        expect(res.value[res.value.length - 1]).toBe(2)
      })

      it("handles keys with unusual characters without corruption", async () => {
        const weirdKey = "weird: key/with?strange#chars%and spaces"
        const [key, value] = entry(weirdKey, bytes.a())

        await cache.set(key, value)

        const res = await cache.get(key)

        expect(res).toStrictEqual({ kind: "hit", value })
      })

      it("does not throw on repeated operations across many keys (stability smoke test)", async () => {
        const entries: CacheEntry<Uint8Array>[] = []

        for (let i = 0; i < 100; i++) {
          entries.push([`key${i}`, bytes.a()])
        }

        await cache.setMany(entries)

        const keysArr = entries.map(([key]) => key)

        const res = await cache.getMany(keysArr)

        expect(res.size).toBe(100)
      })

      it("handles very long keys correctly", async () => {
        const longKey = `k:${"a".repeat(4096)}`
        const [key, value] = entry(longKey, bytes.a())

        await cache.set(key, value)

        const res = await cache.get(key)

        expect(res).toStrictEqual({ kind: "hit", value })
      })

      it("handles Unicode keys (emoji, combining marks, and non-Latin scripts) correctly", async () => {
        const complexUnicodeKey = "lang:العربية:中文:हिन्दी:😀:e\u0301:\t"

        const [key, value] = entry(complexUnicodeKey, bytes.b())

        await cache.set(key, value)

        const res = await cache.get(key)

        expect(res).toStrictEqual({ kind: "hit", value })
      })
    })

    describe("concurrency smoke tests", () => {
      it("concurrent sets to different keys are both visible", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())
        const [key3, value3] = entry(keys.three(), bytes.empty())

        await Promise.all([
          cache.set(key1, value1),
          cache.set(key2, value2),
          cache.set(key3, value3),
        ])

        const res = await cache.getMany([key1, key2, key3])

        expectMapEntries(res, [
          [key1, { kind: "hit", value: value1 }],
          [key2, { kind: "hit", value: value2 }],
          [key3, { kind: "hit", value: value3 }],
        ])
      })

      it("concurrent overwrites do not throw and end with one of the written values", async () => {
        const [key, value1] = entry(keys.one(), bytes.a())
        const value2 = bytes.b()

        await Promise.all([cache.set(key, value1), cache.set(key, value2)])

        const res = await cache.get(key)

        expect(res.kind).toBe("hit")
        if (res.kind !== "hit") return

        expect([value1, value2]).toContainEqual(res.value)
      })

      it("set racing with invalidate does not throw and results in either hit or miss", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        await Promise.all([cache.set(key, value), cache.invalidate(key)])

        const res = await cache.get(key)

        expect(res.kind === "hit" || res.kind === "miss").toBe(true)
        if (res.kind === "hit") {
          expect(res.value).toStrictEqual(value)
        }
      })
    })
  })
}
