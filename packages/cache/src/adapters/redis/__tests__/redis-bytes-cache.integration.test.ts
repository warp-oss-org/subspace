import { createRedisTestClient } from "../../../tests/utils/create-redis-test-client"
import {
  deleteKeysByPrefix,
  getKeysByPrefix,
} from "../../../tests/utils/delete-keys-by-prefix"
import { RedisBytesCache } from "../redis-bytes-cache"
import type { RedisBytesClient } from "../redis-client"

const encoder = new TextEncoder()
const bytes = (s: string): Uint8Array => encoder.encode(s)

const sleep = async (ms: number): Promise<void> =>
  await new Promise((resolve) => setTimeout(resolve, ms))

describe("RedisBytesCache (integration)", () => {
  let keyspacePrefix: string
  let client: RedisBytesClient
  let cache: RedisBytesCache

  beforeAll(async () => {
    const redisTestClient = createRedisTestClient()

    client = redisTestClient.client
    keyspacePrefix = redisTestClient.keyspacePrefix
    cache = new RedisBytesCache(client, {
      keyspacePrefix,
      batchSize: 1000,
    })

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
      const key = "a"
      const value = bytes("value-a")

      await cache.set(key, value)

      const redisKeys = await getKeysByPrefix(client, keyspacePrefix)

      expect(redisKeys).toContain(`${keyspacePrefix}:${key}`)
      expect(redisKeys).not.toContain(key)

      const unprefixed = await client.get(key)
      expect(unprefixed).toBeNull()

      const prefixed = await client.get(`${keyspacePrefix}:${key}`)
      expect(prefixed).not.toBeNull()
    })

    it("does not double-prefix keys", async () => {
      const key = "b"
      const value = bytes("value-b")

      await cache.set(key, value)

      const doublePrefixedKeys = await getKeysByPrefix(
        client,
        `${keyspacePrefix}:${keyspacePrefix}`,
      )

      expect(doublePrefixedKeys).toStrictEqual([])

      const redisKeys = await getKeysByPrefix(client, keyspacePrefix)

      expect(redisKeys).toContain(`${keyspacePrefix}:${key}`)
    })
  })

  describe("TTL integration", () => {
    it("TTL is persisted at Redis level (sanity)", async () => {
      const key = "ttl:1"
      const value = bytes("ttl-value")
      const ttlMs = 2_000

      await cache.set(key, value, {
        ttl: { kind: "milliseconds", milliseconds: ttlMs },
      })

      const fullKey = `${keyspacePrefix}:${key}`

      const remaining = await client.pTTL(fullKey)

      expect(remaining).toBeGreaterThan(0)
      expect(remaining).toBeLessThanOrEqual(ttlMs)
    })

    it("until-date in the past results in immediate miss", async () => {
      const key = "ttl:past"
      const value = bytes("past")
      const past = new Date(Date.now() - 5_000)

      await cache.set(key, value, {
        ttl: { kind: "until", expiresAt: past },
      })

      const res = await cache.get(key)
      expect(res).toStrictEqual({ kind: "miss" })

      const fullKey = `${keyspacePrefix}:${key}`
      const stored = await client.get(fullKey)

      expect(stored).toBeNull()
    })

    it("writing without TTL preserves any existing TTL", async () => {
      const key = "ttl:preserve"
      const value = bytes("preserve")
      const ttlMs = 60

      await cache.set(key, value, {
        ttl: { kind: "milliseconds", milliseconds: ttlMs },
      })

      await cache.set(key, value)

      const fullKey = `${keyspacePrefix}:${key}`

      const remaining = await client.pTTL(fullKey)
      expect(remaining).toBeGreaterThan(0)

      await sleep(ttlMs + 50)

      const res = await cache.get(key)
      expect(res).toStrictEqual({ kind: "miss" })
    })
  })

  describe("bulk ops", () => {
    it("setMany writes all entries within a MULTI/EXEC batch", async () => {
      const entries = [
        ["m:a", bytes("A")],
        ["m:b", bytes("B")],
        ["m:c", bytes("C")],
      ] as const

      await cache.setMany(entries)

      for (const [k, v] of entries) {
        const res = await cache.get(k)
        expect(res).toStrictEqual({ kind: "hit", value: v })
      }
    })

    it("invalidateMany handles large key counts without throwing", async () => {
      const total = 2_500
      const keys: string[] = []

      const chunkSize = 250
      for (let i = 0; i < total; i++) keys.push(`bulk:${i}`)

      for (let i = 0; i < keys.length; i += chunkSize) {
        const chunk = keys
          .slice(i, i + chunkSize)
          .map((k) => [k, bytes(`v:${k}`)] as const)
        await cache.setMany(chunk)
      }

      await expect(cache.invalidateMany(keys)).resolves.toBeUndefined()

      const remaining = await getKeysByPrefix(client, `${keyspacePrefix}bulk:`)

      expect(remaining).toStrictEqual([])
    })
  })
})
