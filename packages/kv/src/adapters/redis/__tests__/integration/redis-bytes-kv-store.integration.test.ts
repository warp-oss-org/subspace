import { createRedisTestClient } from "../../../../tests/utils/create-redis-test-client"
import {
  deleteKeysByPrefix,
  getKeysByPrefix,
} from "../../../../tests/utils/delete-keys-by-prefix"
import { RedisBytesKeyValueStore } from "../../redis-bytes-kv-store"
import type { RedisBytesClient } from "../../redis-client"

describe("RedisBytesKeyValueStore (integration)", () => {
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

  describe("keyspace wiring", () => {
    it("applies keyspacePrefix to all operations", async () => {
      const store = new RedisBytesKeyValueStore(client, {
        keyspacePrefix,
        batchSize: 1000,
      })

      const key = "a"
      const value = new Uint8Array([1, 2, 3])

      await store.set(key, value)

      const redisKeys = await getKeysByPrefix(client, keyspacePrefix)

      expect(redisKeys).toContain(`${keyspacePrefix}${key}`)
      expect(redisKeys).not.toContain(key)

      const res = await store.get(key)

      expect(res.kind).toBe("found")
      if (res.kind === "found") {
        expect(Array.from(res.value)).toStrictEqual(Array.from(value))
      }
    })

    it("does not double-prefix keys", async () => {
      const store = new RedisBytesKeyValueStore(client, {
        keyspacePrefix,
        batchSize: 1000,
      })

      const key = "b"
      const value = new Uint8Array([4, 5, 6])

      await store.set(key, value)

      const redisKeys = await getKeysByPrefix(client, keyspacePrefix)

      expect(redisKeys).toContain(`${keyspacePrefix}${key}`)
      expect(redisKeys).not.toContain(`${keyspacePrefix}${keyspacePrefix}${key}`)
    })
  })

  describe("TTL integration", () => {
    it("TTL is persisted at Redis level (sanity)", async () => {
      const store = new RedisBytesKeyValueStore(client, {
        keyspacePrefix,
        batchSize: 1000,
      })

      const key = "ttl:one"
      const value = new Uint8Array([7, 8, 9])

      await store.set(key, value, {
        ttl: { kind: "milliseconds", milliseconds: 250 },
      })

      const fullKey = `${keyspacePrefix}${key}`
      const ttlMs = await client.pTTL(fullKey)

      expect(ttlMs).toBeGreaterThan(0)
      expect(ttlMs).toBeLessThanOrEqual(250)
    })

    it("writing without TTL preserves existing TTL", async () => {
      const store = new RedisBytesKeyValueStore(client, {
        keyspacePrefix,
        batchSize: 1000,
      })

      const key = "ttl:two"
      const value1 = new Uint8Array([1])
      const value2 = new Uint8Array([2])

      await store.set(key, value1, {
        ttl: { kind: "milliseconds", milliseconds: 300 },
      })

      const fullKey = `${keyspacePrefix}${key}`
      const before = await client.pTTL(fullKey)

      expect(before).toBeGreaterThan(0)

      await store.set(key, value2)

      const after = await client.pTTL(fullKey)
      expect(after).toBeGreaterThan(0)

      const res = await store.get(key)

      expect(res.kind).toBe("found")
      if (res.kind === "found") {
        expect(Array.from(res.value)).toStrictEqual(Array.from(value2))
      }
    })
  })

  describe("bulk ops", () => {
    it("setMany writes all entries", async () => {
      const store = new RedisBytesKeyValueStore(client, {
        keyspacePrefix,
        batchSize: 500,
      })

      const entries: Array<[string, Uint8Array]> = []
      for (let i = 0; i < 1200; i++) {
        entries.push([`bulk:set:${i}`, new Uint8Array([i % 256])])
      }

      await store.setMany(entries)

      const keys = entries.map(([k]) => k)
      const res = await store.getMany(keys)

      expect(res.size).toBe(keys.length)

      for (const [k, v] of entries) {
        const got = res.get(k)
        expect(got?.kind).toBe("found")
        if (got?.kind === "found") {
          expect(Array.from(got.value)).toStrictEqual(Array.from(v))
        }
      }
    })

    it("deleteMany handles large key counts without throwing", async () => {
      const store = new RedisBytesKeyValueStore(client, {
        keyspacePrefix,
        batchSize: 500,
      })

      const keys: string[] = []
      for (let i = 0; i < 1200; i++) {
        const k = `bulk:del:${i}`
        keys.push(k)
        await store.set(k, new Uint8Array([1]))
      }

      await store.deleteMany(keys)

      const res = await store.getMany(keys)
      for (const k of keys) {
        expect(res.get(k)).toStrictEqual({ kind: "not_found" })
      }
    })
  })

  describe("connection lifecycle", () => {
    it("operations fail when client disconnects", async () => {
      const store = new RedisBytesKeyValueStore(client, {
        keyspacePrefix,
        batchSize: 1000,
      })

      const key = "conn:one"

      await (client as any).disconnect?.()

      await expect(store.get(key)).rejects.toBeDefined()

      await client.connect()
    })

    it("operations work after client reconnects", async () => {
      const store = new RedisBytesKeyValueStore(client, {
        keyspacePrefix,
        batchSize: 1000,
      })

      const key = "conn:two"
      const value = new Uint8Array([9, 9, 9])

      await store.set(key, value)

      await (client as any).disconnect?.()
      await client.connect()

      const res = await store.get(key)

      expect(res.kind).toBe("found")
      if (res.kind === "found") {
        expect(Array.from(res.value)).toStrictEqual(Array.from(value))
      }
    })
  })

  describe("large data handling", () => {
    it("handles large values", async () => {
      const store = new RedisBytesKeyValueStore(client, {
        keyspacePrefix,
        batchSize: 1000,
      })

      const key = "large:value"
      const value = new Uint8Array(1024 * 1024)
      for (let i = 0; i < value.length; i += 4096) {
        value[i] = (i / 4096) % 256
      }

      await store.set(key, value)

      const res = await store.get(key)
      expect(res.kind).toBe("found")
      if (res.kind === "found") {
        expect(res.value.byteLength).toBe(value.byteLength)
        for (let i = 0; i < value.length; i += 4096) {
          expect(res.value[i]).toBe(value[i])
        }
      }
    })

    it("handles batch operations with many keys (1000+)", async () => {
      const store = new RedisBytesKeyValueStore(client, {
        keyspacePrefix,
        batchSize: 250,
      })

      const entries: Array<[string, Uint8Array]> = []
      for (let i = 0; i < 1500; i++) {
        entries.push([`large:batch:${i}`, new Uint8Array([i % 256])])
      }

      await store.setMany(entries)

      const keys = entries.map(([k]) => k)
      const res = await store.getMany(keys)

      expect(res.size).toBe(keys.length)
    })
  })
})
