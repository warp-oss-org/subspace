import { createRedisTestClient } from "../../../../tests/utils/create-redis-test-client"
import { deleteKeysByPrefix } from "../../../../tests/utils/delete-keys-by-prefix"
import { keys } from "../../../../tests/utils/kv-test-helpers"
import { RedisBytesKeyValueStore } from "../../redis-bytes-kv-store"
import type { RedisBytesClient } from "../../redis-client"

describe("RedisBytesKeyValueStore (behavior)", () => {
  let keyspacePrefix: string
  let client: RedisBytesClient
  let store: RedisBytesKeyValueStore

  beforeAll(async () => {
    const redisTestClient = createRedisTestClient()

    client = redisTestClient.client
    keyspacePrefix = redisTestClient.keyspacePrefix

    await client.connect()

    store = new RedisBytesKeyValueStore(client, { keyspacePrefix, batchSize: 2 })
  })

  afterEach(async () => {
    await deleteKeysByPrefix(client, keyspacePrefix)
  })

  afterAll(async () => {
    await client.quit()
  })

  describe("batching policy", () => {
    it("respects batchSize for getMany", async () => {
      const allKeys = [keys.one(), keys.two(), keys.three(), keys.four(), keys.five()]

      await store.setMany(allKeys.map((k) => [k, new Uint8Array([1])]))

      const spy = vi.spyOn(client, "mGet")

      await store.getMany(allKeys)

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

      await store.setMany(entries)

      expect(multiSpy).toHaveBeenCalledTimes(3)
    })

    it("respects batchSize for deleteMany", async () => {
      const allKeys = [keys.one(), keys.two(), keys.three(), keys.four(), keys.five()]

      await store.setMany(allKeys.map((k) => [k, new Uint8Array([1])]))

      const delSpy = vi.spyOn(client, "del")

      await store.deleteMany(allKeys)

      expect(delSpy).toHaveBeenCalledTimes(3)
    })
  })

  describe("keyspace isolation", () => {
    it("two stores with different keyspacePrefix do not interfere", async () => {
      const storeA = new RedisBytesKeyValueStore(client, {
        batchSize: 2,
        keyspacePrefix: `${keyspacePrefix}-A`,
      })
      const storeB = new RedisBytesKeyValueStore(client, {
        batchSize: 2,
        keyspacePrefix: `${keyspacePrefix}-B`,
      })

      const key = keys.one()
      const valueA = new Uint8Array([1])
      const valueB = new Uint8Array([2])

      await storeA.set(key, valueA)
      await storeB.set(key, valueB)

      const fetchedA = await storeA.get(key)
      const fetchedB = await storeB.get(key)

      expect(fetchedA).toEqual({ kind: "found", value: valueA })
      expect(fetchedB).toEqual({ kind: "found", value: valueB })
    })

    it("two stores with same keyspacePrefix share keys", async () => {
      const storeA = new RedisBytesKeyValueStore(client, {
        batchSize: 2,
        keyspacePrefix: `${keyspacePrefix}-C`,
      })
      const storeB = new RedisBytesKeyValueStore(client, {
        batchSize: 2,
        keyspacePrefix: `${keyspacePrefix}-C`,
      })

      const key = keys.one()
      const valueA = new Uint8Array([1])
      const valueB = new Uint8Array([2])

      await storeA.set(key, valueA)
      await storeB.set(key, valueB)

      const fetchedA = await storeA.get(key)
      const fetchedB = await storeB.get(key)

      expect(fetchedA).toEqual({ kind: "found", value: valueB })
      expect(fetchedB).toEqual({ kind: "found", value: valueB })
    })
  })
})
