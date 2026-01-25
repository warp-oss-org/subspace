import { sleep } from "../../../../tests/sleep"
import { createRedisTestClient } from "../../../../tests/utils/create-redis-test-client"
import { deleteKeysByPrefix } from "../../../../tests/utils/delete-keys-by-prefix"
import { RedisBytesKeyValueStoreConditional } from "../../redis-bytes-kv-conditional"
import { RedisBytesKeyValueStore } from "../../redis-bytes-kv-store"
import type { RedisBytesClient } from "../../redis-client"

describe("RedisBytesKeyValueStoreConditional (integration)", () => {
  let keyspacePrefix: string
  let client: RedisBytesClient

  beforeAll(async () => {
    const redisTestClient = createRedisTestClient()

    client = redisTestClient.client
    keyspacePrefix = redisTestClient.keyspacePrefix

    await client.connect()
  })

  afterEach(async () => {
    await deleteKeysByPrefix(client, keyspacePrefix)
  })

  afterAll(async () => {
    await client.quit()
  })

  describe("lock patterns", () => {
    let baseStore: RedisBytesKeyValueStore
    let store: RedisBytesKeyValueStoreConditional
    beforeAll(() => {
      baseStore = new RedisBytesKeyValueStore(
        { client },
        {
          keyspacePrefix,
          batchSize: 1000,
        },
      )

      store = new RedisBytesKeyValueStoreConditional(
        { client, baseStore },
        { keyspacePrefix, batchSize: 1000 },
      )
    })

    it("acquire lock with setIfNotExists + TTL", async () => {
      const key = `${keyspacePrefix}:lock1`
      const value = Buffer.from("token1")
      const ttlMs = 500

      const acquired = await store.setIfNotExists(key, value, {
        ttl: { kind: "milliseconds", milliseconds: ttlMs },
      })

      expect(acquired.kind).toBe("written")

      const reacquire = await store.setIfNotExists(key, Buffer.from("token2"), {
        ttl: { kind: "milliseconds", milliseconds: ttlMs },
      })
      expect(reacquire.kind).toBe("skipped")
    })

    it("lock auto-expires after TTL", async () => {
      const key = `${keyspacePrefix}:lock2`
      const value = Buffer.from("token1")
      const ttlMs = 200

      await store.setIfNotExists(key, value, {
        ttl: { kind: "milliseconds", milliseconds: ttlMs },
      })

      await sleep(ttlMs + 50)

      const reacquire = await store.setIfNotExists(key, Buffer.from("token2"), {
        ttl: { kind: "milliseconds", milliseconds: ttlMs },
      })
      expect(reacquire.kind).toBe("written")
    })

    it("second acquirer succeeds after TTL expiry", async () => {
      const key = `${keyspacePrefix}:lock3`
      const value1 = Buffer.from("token1")
      const value2 = Buffer.from("token2")
      const ttlMs = 150

      const first = await store.setIfNotExists(key, value1, {
        ttl: { kind: "milliseconds", milliseconds: ttlMs },
      })
      expect(first.kind).toBe("written")

      const second = await store.setIfNotExists(key, value2, {
        ttl: { kind: "milliseconds", milliseconds: ttlMs },
      })
      expect(second.kind).toBe("skipped")

      await sleep(ttlMs + 50)

      const third = await store.setIfNotExists(key, value2, {
        ttl: { kind: "milliseconds", milliseconds: ttlMs },
      })
      expect(third.kind).toBe("written")
    })
  })
})
