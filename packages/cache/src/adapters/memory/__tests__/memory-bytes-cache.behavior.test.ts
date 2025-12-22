import { FifoMemoryMap } from "../../../core/eviction/fifo-memory-map"
import { LruMemoryMap } from "../../../core/eviction/lru-memory-map"
import type { CacheKey } from "../../../ports/cache-key"
import { bytes, entry, keys } from "../../../tests/utils/cache-test-helpers"
import { ManualTestClock } from "../../../tests/utils/manual-test-clock"
import { MemoryBytesCache, type MemoryCacheEntry } from "../memory-bytes-cache"

describe("MemoryBytesCache", () => {
  let cache: MemoryBytesCache

  beforeEach(() => {
    cache = new MemoryBytesCache(
      { clock: new ManualTestClock(new Date(0)), store: new LruMemoryMap() },
      { maxEntries: 100 },
    )
  })

  describe("TTL policy behavior", () => {
    it("entries expire based on injected clock (not Date.now directly)", async () => {
      const clock = new ManualTestClock(new Date("2020-01-01T00:00:00.000Z"))
      cache = new MemoryBytesCache(
        { clock, store: new LruMemoryMap() },
        { maxEntries: 100 },
      )

      const expirationInMs = 5
      await cache.set(keys.one(), bytes.a(), {
        ttl: {
          kind: "until",
          expiresAt: new Date(clock.now().getTime() + expirationInMs),
        },
      })

      clock.advanceMs(expirationInMs + 1)

      const res = await cache.get(keys.one())
      expect(res).toStrictEqual({ kind: "miss" })
    })

    it("writing without TTL clears any existing TTL (no expiry afterwards)", async () => {
      const clock = new ManualTestClock(new Date("2020-01-01T00:00:00.000Z"))
      cache = new MemoryBytesCache(
        { clock, store: new LruMemoryMap() },
        { maxEntries: 100 },
      )

      const expirationInMs = 5
      await cache.set(keys.one(), bytes.a(), {
        ttl: {
          kind: "until",
          expiresAt: new Date(clock.now().getTime() + expirationInMs),
        },
      })

      await cache.set(keys.one(), bytes.b())

      clock.advanceMs(expirationInMs + 1)

      const res = await cache.get(keys.one())
      expect(res).toStrictEqual({ kind: "hit", value: bytes.b() })
    })

    it("until-date in the past results in immediate miss", async () => {
      const clock = new ManualTestClock(new Date("2020-01-01T00:00:00.000Z"))
      cache = new MemoryBytesCache(
        { clock, store: new LruMemoryMap() },
        { maxEntries: 100 },
      )

      await cache.set(keys.one(), bytes.a(), {
        ttl: { kind: "until", expiresAt: new Date(clock.now().getTime() - 1) },
      })

      const res = await cache.get(keys.one())

      expect(res).toStrictEqual({ kind: "miss" })
    })
  })

  describe("capacity & eviction integration", () => {
    it("throws RangeError when a single setMany call requires more new entries than maxEntries", async () => {
      cache = new MemoryBytesCache(
        {
          clock: new ManualTestClock(new Date("2020-01-01T00:00:00.000Z")),
          store: new LruMemoryMap(),
        },
        { maxEntries: 2 },
      )

      await expect(
        cache.setMany([
          entry(keys.one(), bytes.a()),
          entry(keys.two(), bytes.b()),
          entry(keys.three(), bytes.c()),
        ]),
      ).rejects.toThrow(RangeError)

      const resOne = await cache.get(keys.one())
      const resTwo = await cache.get(keys.two())
      const resThree = await cache.get(keys.three())

      expect(resOne).toStrictEqual({ kind: "miss" })
      expect(resTwo).toStrictEqual({ kind: "miss" })
      expect(resThree).toStrictEqual({ kind: "miss" })
    })
  })

  describe("store implementations", () => {
    it("works with LruMemoryMap store", async () => {
      const customCache = new MemoryBytesCache(
        {
          clock: new ManualTestClock(new Date("2020-01-01T00:00:00.000Z")),
          store: new LruMemoryMap(),
        },
        { maxEntries: 2 },
      )

      await customCache.set(keys.one(), bytes.a())
      await customCache.set(keys.two(), bytes.b())

      const valBeforeInvalidate = await customCache.get(keys.one())

      await customCache.invalidate(keys.one())

      const valAfterInvalidate = await customCache.get(keys.one())

      expect(valBeforeInvalidate).toStrictEqual({
        kind: "hit",
        value: bytes.a(),
      })
      expect(valAfterInvalidate).toStrictEqual({ kind: "miss" })
    })

    it("works with FifoMemoryMap store", async () => {
      const customCache = new MemoryBytesCache(
        {
          clock: new ManualTestClock(new Date("2020-01-01T00:00:00.000Z")),
          store: new FifoMemoryMap(),
        },
        { maxEntries: 3 },
      )

      await customCache.set(keys.one(), bytes.a())
      await customCache.set(keys.two(), bytes.b())
      await customCache.set(keys.three(), bytes.c())

      const val1 = await customCache.get(keys.one())
      const val2 = await customCache.get(keys.two())
      const val3 = await customCache.get(keys.three())

      expect(val1).toStrictEqual({ kind: "hit", value: bytes.a() })
      expect(val2).toStrictEqual({ kind: "hit", value: bytes.b() })
      expect(val3).toStrictEqual({ kind: "hit", value: bytes.c() })
    })
  })

  describe("eviction policy behavior (store-defined)", () => {
    it("LRU: recently accessed key is less likely to be evicted (access updates recency)", async () => {
      cache = new MemoryBytesCache(
        { clock: new ManualTestClock(new Date(0)), store: new LruMemoryMap() },
        { maxEntries: 2 },
      )

      await cache.set(keys.one(), bytes.a())
      await cache.set(keys.two(), bytes.b())

      const touched = await cache.get(keys.one())
      expect(touched).toStrictEqual({ kind: "hit", value: bytes.a() })

      await cache.set(keys.three(), bytes.c())

      const resOne = await cache.get(keys.one())
      const resTwo = await cache.get(keys.two())
      const resThree = await cache.get(keys.three())

      expect(resTwo).toStrictEqual({ kind: "miss" })
      expect(resOne).toStrictEqual({ kind: "hit", value: bytes.a() })
      expect(resThree).toStrictEqual({ kind: "hit", value: bytes.c() })
    })

    it("FIFO: insertion order governs eviction (access does not affect eviction order)", async () => {
      cache = new MemoryBytesCache(
        { clock: new ManualTestClock(new Date(0)), store: new FifoMemoryMap() },
        { maxEntries: 2 },
      )

      await cache.set(keys.one(), bytes.a())
      await cache.set(keys.two(), bytes.b())

      const touched = await cache.get(keys.one())
      expect(touched).toStrictEqual({ kind: "hit", value: bytes.a() })

      await cache.set(keys.three(), bytes.c())

      const resOne = await cache.get(keys.one())
      const resTwo = await cache.get(keys.two())
      const resThree = await cache.get(keys.three())

      expect(resOne).toStrictEqual({ kind: "miss" })
      expect(resTwo).toStrictEqual({ kind: "hit", value: bytes.b() })
      expect(resThree).toStrictEqual({ kind: "hit", value: bytes.c() })
    })

    it("FIFO: eviction follows strict insertion order across multiple evictions", async () => {
      cache = new MemoryBytesCache(
        { clock: new ManualTestClock(new Date(0)), store: new FifoMemoryMap() },
        { maxEntries: 2 },
      )

      await cache.set(keys.one(), bytes.a())
      await cache.set(keys.two(), bytes.b())
      await cache.set(keys.three(), bytes.c())

      const resOne = await cache.get(keys.one())
      let resTwo = await cache.get(keys.two())
      const resThree = await cache.get(keys.three())

      expect(resOne).toStrictEqual({ kind: "miss" })
      expect(resTwo).toStrictEqual({ kind: "hit", value: bytes.b() })
      expect(resThree).toStrictEqual({ kind: "hit", value: bytes.c() })

      await cache.set("four", bytes.a())

      resTwo = await cache.get(keys.two())
      const resFour = await cache.get("four")

      expect(resTwo).toStrictEqual({ kind: "miss" })
      expect(resFour).toStrictEqual({ kind: "hit", value: bytes.a() })
    })
  })

  describe("keyspace isolation", () => {
    it("two caches with different store instances do not interfere", async () => {
      const clock = new ManualTestClock(new Date(0))

      const cacheA = new MemoryBytesCache(
        { clock, store: new LruMemoryMap() },
        { maxEntries: 100 },
      )
      const cacheB = new MemoryBytesCache(
        { clock, store: new LruMemoryMap() },
        { maxEntries: 100 },
      )

      await cacheA.set(keys.one(), bytes.a())

      const resA = await cacheA.get(keys.one())
      const resB = await cacheB.get(keys.one())

      expect(resA).toStrictEqual({ kind: "hit", value: bytes.a() })
      expect(resB).toStrictEqual({ kind: "miss" })
    })

    it("two caches sharing the same store instance can interfere", async () => {
      const clock = new ManualTestClock(new Date(0))
      const sharedStore = new LruMemoryMap<CacheKey, MemoryCacheEntry>()

      const cacheA = new MemoryBytesCache(
        { clock, store: sharedStore },
        { maxEntries: 100 },
      )
      const cacheB = new MemoryBytesCache(
        { clock, store: sharedStore },
        { maxEntries: 100 },
      )

      await cacheA.set(keys.one(), bytes.a())

      const res = await cacheB.get(keys.one())
      expect(res).toStrictEqual({ kind: "hit", value: bytes.a() })
    })
  })

  describe("batching policy", () => {
    it("setMany handles many entries", async () => {
      const entries = Array.from({ length: 50 }, (_, i) =>
        entry(`k:${i}`, new Uint8Array([i % 256])),
      )

      await cache.setMany(entries)

      const res = await cache.getMany(["k:0", "k:1", "k:49", "k:missing"])

      const resMissing = res.get("k:missing")
      const res0 = res.get("k:0")
      const res1 = res.get("k:1")
      const res49 = res.get("k:49")

      expect(res.size).toBe(4)
      expect(resMissing).toStrictEqual({ kind: "miss" })
      expect(res0).toStrictEqual({ kind: "hit", value: new Uint8Array([0]) })
      expect(res1).toStrictEqual({ kind: "hit", value: new Uint8Array([1]) })
      expect(res49).toStrictEqual({ kind: "hit", value: new Uint8Array([49]) })
    })
  })
})
