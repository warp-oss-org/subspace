import { keys } from "../../../tests/utils/cache-test-helpers"
import { createRedisTestClient } from "../../../tests/utils/create-redis-test-client"
import { deleteKeysByPrefix } from "../../../tests/utils/delete-keys-by-prefix"
import { RedisBytesCache } from "../redis-bytes-cache"
import type { RedisBytesClient } from "../redis-client"

describe("RedisBytesCache (behavior)", () => {
  let keyspacePrefix: string
  let client: RedisBytesClient

  let cache: RedisBytesCache

  beforeAll(async () => {
    const redisTestClient = createRedisTestClient()

    client = redisTestClient.client
    keyspacePrefix = redisTestClient.keyspacePrefix

    await client.connect()

    cache = new RedisBytesCache(client, { keyspacePrefix, batchSize: 2 })
  })

  afterAll(async () => {
    await client.quit()
  })

  beforeEach(async () => {
    await deleteKeysByPrefix(client, keyspacePrefix)
  })

  describe("batching policy", () => {
    it("respects batchSize for getMany", async () => {
      const allKeys = [keys.one(), keys.two(), keys.three(), keys.four(), keys.five()]

      await cache.setMany(allKeys.map((k) => [k, new Uint8Array([1])]))

      const spy = vi.spyOn(client, "mGet")

      await cache.getMany(allKeys)

      expect(spy).toHaveBeenCalledTimes(3)
      expect(spy.mock.calls.map(([arg]) => arg.length)).toStrictEqual([2, 2, 1])
    })

    it("respects batchSize for setMany", async () => {
      const entries = [
        ["k1", new Uint8Array([1])],
        ["k2", new Uint8Array([2])],
        ["k3", new Uint8Array([3])],
        ["k4", new Uint8Array([4])],
        ["k5", new Uint8Array([5])],
      ] as const

      const multiSpy = vi.spyOn(client, "multi")

      await cache.setMany(entries)

      expect(multiSpy).toHaveBeenCalledTimes(3)
    })

    it("respects batchSize for invalidateMany", async () => {
      const allKeys = [keys.one(), keys.two(), keys.three(), keys.four(), keys.five()]

      await cache.setMany(allKeys.map((k) => [k, new Uint8Array([1])]))

      const delSpy = vi.spyOn(client, "del")

      await cache.invalidateMany(allKeys)

      expect(delSpy).toHaveBeenCalledTimes(3)
    })
  })

  describe("keyspace isolation", () => {
    it("two caches with different keyspacePrefix do not interfere", async () => {
      const cacheA = new RedisBytesCache(client, {
        batchSize: 2,
        keyspacePrefix: `${keyspacePrefix}-A`,
      })
      const cacheB = new RedisBytesCache(client, {
        batchSize: 2,
        keyspacePrefix: `${keyspacePrefix}-B`,
      })

      const key = keys.one()
      const valueA = new Uint8Array([1])
      const valueB = new Uint8Array([2])

      await cacheA.set(key, valueA)
      await cacheB.set(key, valueB)

      const fetchedA = await cacheA.get(key)
      const fetchedB = await cacheB.get(key)

      expect(fetchedA).toEqual({ kind: "hit", value: valueA })
      expect(fetchedB).toEqual({ kind: "hit", value: valueB })
    })

    it("two caches with same keyspacePrefix interfere as expected", async () => {
      const cacheA = new RedisBytesCache(client, {
        batchSize: 2,
        keyspacePrefix: `${keyspacePrefix}-C`,
      })
      const cacheB = new RedisBytesCache(client, {
        batchSize: 2,
        keyspacePrefix: `${keyspacePrefix}-C`,
      })

      const key = keys.one()
      const valueA = new Uint8Array([1])
      const valueB = new Uint8Array([2])

      await cacheA.set(key, valueA)
      await cacheB.set(key, valueB)

      const fetchedA = await cacheA.get(key)
      const fetchedB = await cacheB.get(key)

      expect(fetchedA).toEqual({ kind: "hit", value: valueB })
      expect(fetchedB).toEqual({ kind: "hit", value: valueB })
    })
  })
})
