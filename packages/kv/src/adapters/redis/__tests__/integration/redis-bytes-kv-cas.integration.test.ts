import { createRedisTestClient } from "../../../../tests/utils/create-redis-test-client"
import { deleteKeysByPrefix } from "../../../../tests/utils/delete-keys-by-prefix"
import { RedisBytesKeyValueStoreCas } from "../../redis-bytes-kv-cas"
import type { RedisBytesClient } from "../../redis-client"

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

function asUtf8(b: Uint8Array): string {
  return new TextDecoder().decode(b)
}

async function casUpdateJson<T>(
  store: RedisBytesKeyValueStoreCas,
  key: string,
  fn: (current: T) => T,
): Promise<void> {
  while (true) {
    const current = await store.getVersioned(key)
    if (current.kind !== "found") throw new Error("expected key to exist")

    const next = fn(JSON.parse(asUtf8(current.value)) as T)
    const res = await store.setIfVersion(key, utf8(JSON.stringify(next)), current.version)

    if (res.kind === "written") return
    if (res.kind === "not_found")
      throw new Error("unexpected not_found during CAS update")
  }
}

describe("RedisBytesKeyValueStoreCas (integration)", () => {
  let keyspacePrefix: string
  let client: RedisBytesClient
  let store: RedisBytesKeyValueStoreCas

  beforeAll(async () => {
    const redisTestClient = createRedisTestClient()

    client = redisTestClient.client
    keyspacePrefix = redisTestClient.keyspacePrefix

    await client.connect()

    store = new RedisBytesKeyValueStoreCas(
      { client },
      { keyspacePrefix, batchSize: 1000 },
    )
  })

  afterEach(async () => {
    await deleteKeysByPrefix(client, keyspacePrefix)
  })

  afterAll(async () => {
    await client.quit()
  })

  describe("contention", () => {
    it("retry loop eventually succeeds after conflict", async () => {
      const key = "counter"
      await store.set(key, utf8("0"))

      const stale = await store.getVersioned(key)
      if (stale.kind !== "found") throw new Error("expected found")

      // Another writer updates
      await store.set(key, utf8("1"))

      // First attempt with stale version fails
      const res1 = await store.setIfVersion(key, utf8("2"), stale.version)
      expect(res1.kind).toBe("conflict")

      // Retry with fresh version succeeds
      const fresh = await store.getVersioned(key)
      if (fresh.kind !== "found") throw new Error("expected found")

      const res2 = await store.setIfVersion(key, utf8("2"), fresh.version)
      expect(res2.kind).toBe("written")

      const final = await store.get(key)
      if (final.kind !== "found") throw new Error("expected found")
      expect(asUtf8(final.value)).toBe("2")
    })

    it("high contention: multiple writers converge to consistent state", async () => {
      const key = "counter"
      await store.set(key, utf8(JSON.stringify({ n: 0 })))

      const writers = 8
      const incrementsPerWriter = 20

      await Promise.all(
        Array.from({ length: writers }, async () => {
          for (let i = 0; i < incrementsPerWriter; i++) {
            await casUpdateJson<{ n: number }>(store, key, (cur) => ({ n: cur.n + 1 }))
          }
        }),
      )

      const res = await store.get(key)
      if (res.kind !== "found") throw new Error("expected found")

      const obj = JSON.parse(asUtf8(res.value)) as { n: number }
      expect(obj.n).toBe(writers * incrementsPerWriter)
    })

    it("no partial writes on conflict", async () => {
      const key = "race"
      await store.set(key, utf8("base"))

      const current = await store.getVersioned(key)
      if (current.kind !== "found") throw new Error("expected found")

      const [a, b] = await Promise.all([
        store.setIfVersion(key, utf8("A"), current.version),
        store.setIfVersion(key, utf8("B"), current.version),
      ])

      const outcomes = [a.kind, b.kind].sort()
      expect(outcomes).toEqual(["conflict", "written"])

      const stored = await store.get(key)
      if (stored.kind !== "found") throw new Error("expected found")

      const value = asUtf8(stored.value)
      expect(value === "A" || value === "B").toBe(true)
    })
  })

  describe("real-world patterns", () => {
    it("counter increment with CAS retry loop", async () => {
      const key = "counter"
      await store.set(key, utf8(JSON.stringify({ n: 0 })))

      for (let i = 0; i < 50; i++) {
        await casUpdateJson<{ n: number }>(store, key, (cur) => ({ n: cur.n + 1 }))
      }

      const res = await store.get(key)
      if (res.kind !== "found") throw new Error("expected found")

      const obj = JSON.parse(asUtf8(res.value)) as { n: number }
      expect(obj.n).toBe(50)
    })

    it("balance transfer with CAS", async () => {
      const key = "ledger"
      await store.set(key, utf8(JSON.stringify({ a: 100, b: 0 })))

      const transfer = async (amount: number) => {
        await casUpdateJson<{ a: number; b: number }>(store, key, (cur) => {
          if (cur.a < amount) return cur
          return { a: cur.a - amount, b: cur.b + amount }
        })
      }

      await Promise.all([transfer(10), transfer(15), transfer(5)])

      const res = await store.get(key)
      if (res.kind !== "found") throw new Error("expected found")

      const obj = JSON.parse(asUtf8(res.value)) as { a: number; b: number }
      expect(obj.a + obj.b).toBe(100)
      expect(obj.a).toBe(70)
      expect(obj.b).toBe(30)
    })
  })

  describe("script compatibility", () => {
    it("EVAL works in standalone Redis mode", async () => {
      const key = "eval-test"
      await store.set(key, utf8("v1"))

      const current = await store.getVersioned(key)
      if (current.kind !== "found") throw new Error("expected found")

      const res = await store.setIfVersion(key, utf8("v2"), current.version)
      expect(res.kind).toBe("written")
    })
  })
})
