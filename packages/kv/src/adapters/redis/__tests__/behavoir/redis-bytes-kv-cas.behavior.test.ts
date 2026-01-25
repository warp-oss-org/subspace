import { createRedisTestClient } from "../../../../tests/utils/create-redis-test-client"
import { deleteKeysByPrefix } from "../../../../tests/utils/delete-keys-by-prefix"
import { bytes, keys } from "../../../../tests/utils/kv-test-helpers"
import { RedisBytesKeyValueStoreCas } from "../../redis-bytes-kv-cas"
import type { RedisBytesClient } from "../../redis-client"

describe("RedisBytesKeyValueStoreCas (behavior)", () => {
  let keyspacePrefix: string
  let client: RedisBytesClient
  let store: RedisBytesKeyValueStoreCas

  beforeAll(async () => {
    const redisTestClient = createRedisTestClient()

    client = redisTestClient.client
    keyspacePrefix = redisTestClient.keyspacePrefix

    await client.connect()

    store = new RedisBytesKeyValueStoreCas({ client }, { keyspacePrefix, batchSize: 2 })
  })

  afterEach(async () => {
    await deleteKeysByPrefix(client, keyspacePrefix)
  })

  afterAll(async () => {
    await client.quit()
  })

  describe("version semantics", () => {
    it("version is opaque string, not predictable", async () => {
      const key = keys.one()
      const value = new Uint8Array([1])

      await store.set(key, value)

      const result = await store.getVersioned(key)

      expect(result.kind).toBe("found")
      if (result.kind === "found") {
        expect(typeof result.version).toBe("string")
        expect(result.version.length).toBeGreaterThan(0)
      }
    })
  })

  describe("TTL and version interaction", () => {
    it("setIfVersion without TTL preserves existing TTL", async () => {
      const key = keys.one()
      const value1 = new Uint8Array([1])
      const value2 = new Uint8Array([2])
      const ttlMs = 5000

      await store.set(key, value1, { ttl: { kind: "milliseconds", milliseconds: ttlMs } })

      const versioned = await store.getVersioned(key)
      expect(versioned.kind).toBe("found")
      if (versioned.kind !== "found") return

      await store.setIfVersion(key, value2, versioned.version)

      const pttl = await client.pTTL(`${keyspacePrefix}:${key}`)

      expect(pttl).toBeGreaterThan(0)
      expect(pttl).toBeLessThanOrEqual(ttlMs)
    })

    it("version key expires with value key", async () => {
      const key = keys.one()
      const value = new Uint8Array([1])
      const ttlMs = 100

      await store.set(key, value, { ttl: { kind: "milliseconds", milliseconds: ttlMs } })

      await new Promise((r) => setTimeout(r, ttlMs + 50))

      const result = await store.getVersioned(key)
      expect(result.kind).toBe("not_found")

      const versionKey = `${keyspacePrefix}:${key}:v`
      const versionExists = await client.exists(versionKey)
      expect(versionExists).toBe(0)
    })
  })

  describe("base operation consistency", () => {
    it("set increments version", async () => {
      const key = keys.one()

      await store.set(key, new Uint8Array([1]))
      const v1 = await store.getVersioned(key)

      await store.set(key, new Uint8Array([2]))
      const v2 = await store.getVersioned(key)

      expect(v1.kind).toBe("found")
      expect(v2.kind).toBe("found")
      if (v1.kind === "found" && v2.kind === "found") {
        expect(v1.version).not.toBe(v2.version)
      }
    })

    it("setMany increments version for each key", async () => {
      const key1 = keys.one()
      const key2 = keys.two()

      await store.set(key1, new Uint8Array([1]))
      await store.set(key2, new Uint8Array([1]))

      const v1Before = await store.getVersioned(key1)
      const v2Before = await store.getVersioned(key2)

      await store.setMany([
        [key1, new Uint8Array([2])],
        [key2, new Uint8Array([2])],
      ])

      const v1After = await store.getVersioned(key1)
      const v2After = await store.getVersioned(key2)

      expect(v1Before.kind).toBe("found")
      expect(v2Before.kind).toBe("found")
      expect(v1After.kind).toBe("found")
      expect(v2After.kind).toBe("found")

      if (
        v1Before.kind === "found" &&
        v2Before.kind === "found" &&
        v1After.kind === "found" &&
        v2After.kind === "found"
      ) {
        expect(v1Before.version).not.toBe(v1After.version)
        expect(v2Before.version).not.toBe(v2After.version)
      }
    })

    it("delete removes both value and version", async () => {
      const key = keys.one()

      await store.set(key, new Uint8Array([1]))
      await store.delete(key)

      const result = await store.getVersioned(key)
      expect(result.kind).toBe("not_found")

      const versionKey = `${keyspacePrefix}:${key}:v`
      const versionExists = await client.exists(versionKey)
      expect(versionExists).toBe(0)
    })

    it("deleteMany removes both value and version for each key", async () => {
      const key1 = keys.one()
      const key2 = keys.two()

      await store.set(key1, new Uint8Array([1]))
      await store.set(key2, new Uint8Array([1]))

      await store.deleteMany([key1, key2])

      const result1 = await store.getVersioned(key1)
      const result2 = await store.getVersioned(key2)

      expect(result1.kind).toBe("not_found")
      expect(result2.kind).toBe("not_found")

      const v1Exists = await client.exists(`${keyspacePrefix}:${key1}:v`)
      const v2Exists = await client.exists(`${keyspacePrefix}:${key2}:v`)

      expect(v1Exists).toBe(0)
      expect(v2Exists).toBe(0)
    })
  })

  describe("metadata isolation", () => {
    it("version keys (:v) are not visible via get", async () => {
      const key = keys.one()

      await store.set(key, new Uint8Array([1]))

      const versionKeyResult = await store.get(`${key}:v`)

      expect(versionKeyResult.kind).toBe("not_found")
    })
  })

  describe("internal metadata keys are ignored", () => {
    it("set does not write when key ends with :v", async () => {
      const key = `${keys.one()}:v`

      await store.set(key, bytes.a())

      const rawKeys = await client.keys(`${keyspacePrefix}*`)
      const redisKeys = rawKeys.map((k) => (Buffer.isBuffer(k) ? k.toString("utf8") : k))

      expect(redisKeys).toStrictEqual([])
    })

    it("delete is a no-op when key ends with :v", async () => {
      const key = keys.one()

      await store.set(key, bytes.a())
      await store.delete(`${key}:v`)

      const res = await store.get(key)

      expect(res.kind).toBe("found")
    })

    it("has is false for :v keys", async () => {
      const key = keys.one()

      await store.set(key, bytes.a())

      const res = await store.has(`${key}:v`)

      expect(res).toBe(false)
    })

    it("getMany returns not_found for :v keys", async () => {
      const key = keys.one()

      await store.set(key, bytes.a())

      const res = await store.getMany([`${key}:v`, key])

      expect(res.get(`${key}:v`)).toStrictEqual({ kind: "not_found" })
      expect(res.get(key)?.kind).toBe("found")
    })

    it("setMany ignores entries whose keys end with :v", async () => {
      const a = keys.one()
      const b = `${keys.two()}:v`

      await store.setMany([
        [a, bytes.a()],
        [b, bytes.b()],
      ])

      const aRes = await store.get(a)
      const bRes = await store.get(b)

      expect(aRes.kind).toBe("found")
      expect(bRes).toStrictEqual({ kind: "not_found" })
    })

    it("deleteMany ignores keys that end with :v", async () => {
      const key = keys.one()

      await store.set(key, bytes.a())
      await store.deleteMany([`${key}:v`])

      const res = await store.get(key)

      expect(res.kind).toBe("found")
    })
  })

  describe("version TTL alignment", () => {
    it("write without TTL preserves existing TTL and keeps version TTL aligned", async () => {
      const key = keys.one()
      const ttlMs = 250

      await store.set(key, bytes.a(), {
        ttl: { kind: "milliseconds", milliseconds: ttlMs },
      })
      await store.set(key, bytes.b())

      const valueTtl = await client.pTTL(`${keyspacePrefix}:${key}`)
      const versionTtl = await client.pTTL(`${keyspacePrefix}:${key}:v`)

      expect(valueTtl).toBeGreaterThan(0)
      expect(versionTtl).toBeGreaterThan(0)
      expect(Math.abs(valueTtl - versionTtl)).toBeLessThan(75)
    })

    it("write without TTL on persistent key keeps version key persistent", async () => {
      const key = keys.one()

      await store.set(key, bytes.a())
      await store.set(key, bytes.b())

      const valueTtl = await client.pTTL(`${keyspacePrefix}:${key}`)
      const versionTtl = await client.pTTL(`${keyspacePrefix}:${key}:v`)

      expect(valueTtl).toBe(-1)
      expect(versionTtl).toBe(-1)
    })
  })
})
