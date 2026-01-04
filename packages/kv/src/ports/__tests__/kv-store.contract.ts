import { sleep } from "../../tests/sleep"
import { bytes, keys } from "../../tests/utils/kv-test-helpers"
import type { BytesKeyValueStore } from "../bytes-kv-store"
import type { KvEntry } from "../kv-value"

export const entry = <T>(key: string, value: T): [string, T] => [key, value]

type CreateBytesKvStore = () => BytesKeyValueStore

export function describeKvStoreContract(
  adapterName: string,
  createStore: CreateBytesKvStore,
): void {
  describe(`BytesKeyValueStore Contract Tests - ${adapterName}`, () => {
    let store: BytesKeyValueStore

    beforeEach(() => {
      store = createStore()
    })

    describe("sanity", () => {
      it("creates a store instance", () => {
        const instance = createStore()

        expect(instance).toBeDefined()
      })

      it("supports being created multiple times (independent instances)", () => {
        const store1 = createStore()
        const store2 = createStore()

        expect(store1).toBeDefined()
        expect(store2).toBeDefined()
        expect(store1).not.toBe(store2)
      })
    })

    describe("get/set basic semantics", () => {
      it("returns not_found when key is absent", async () => {
        const res = await store.get("missing")

        expect(res).toStrictEqual({ kind: "not_found" })
      })

      it("returns found after set with the same bytes that were set (byte-for-byte)", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        await store.set(key, value)

        const res = await store.get(key)

        expect(res).toStrictEqual({ kind: "found", value })
      })

      it("overwriting an existing key updates the stored value", async () => {
        const [key, value1] = entry(keys.one(), bytes.a())
        const value2 = bytes.b()

        await store.set(key, value1)
        await store.set(key, value2)

        const res = await store.get(key)

        expect(res).toStrictEqual({ kind: "found", value: value2 })
      })

      it("set does not mutate the input Uint8Array", async () => {
        const [key, value] = entry(keys.one(), bytes.a())
        const snapshot = value.slice()

        await store.set(key, value)

        expect(value).toStrictEqual(snapshot)
      })
    })

    describe("delete semantics", () => {
      it("delete on absent key is a no-op (does not throw)", async () => {
        await store.delete("missing")
      })

      it("delete removes an existing key (subsequent get is not_found)", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        await store.set(key, value)

        await store.delete(key)

        const res = await store.get(key)

        expect(res).toStrictEqual({ kind: "not_found" })
      })

      it("delete is idempotent (calling twice is safe)", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        await store.set(key, value)

        await store.delete(key)
        await store.delete(key)

        const res = await store.get(key)

        expect(res).toStrictEqual({ kind: "not_found" })
      })
    })

    describe("has semantics", () => {
      it("returns false for absent key", async () => {
        const res = await store.has("missing")

        expect(res).toBe(false)
      })

      it("returns true for present key", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        await store.set(key, value)

        const res = await store.has(key)

        expect(res).toBe(true)
      })

      it("returns false after key is deleted", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        await store.set(key, value)
        await store.delete(key)

        const res = await store.has(key)

        expect(res).toBe(false)
      })

      it("has and get are consistent", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        expect(await store.has(key)).toBe(false)
        expect((await store.get(key)).kind).toBe("not_found")

        await store.set(key, value)

        expect(await store.has(key)).toBe(true)
        expect((await store.get(key)).kind).toBe("found")
      })
    })

    describe("getMany semantics", () => {
      it("getMany([]) returns an empty Map", async () => {
        const res = await store.getMany([])

        expect(res).toStrictEqual(new Map())
      })

      it("getMany preserves key identity: Map keys are the provided KvKey values", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())
        const [key3, value3] = entry(keys.three(), bytes.empty())

        await store.set(key1, value1)
        await store.set(key2, value2)
        await store.set(key3, value3)

        const res = await store.getMany([key1, key2, key3])

        expect(res.get(key1)).toStrictEqual({ kind: "found", value: value1 })
        expect(res.get(key2)).toStrictEqual({ kind: "found", value: value2 })
        expect(res.get(key3)).toStrictEqual({ kind: "found", value: value3 })
      })

      it("getMany returns not_found for absent keys", async () => {
        const [key1, key2] = ["missing1", "missing2"]

        const res = await store.getMany([key1, key2])

        expect(res.get(key1)).toStrictEqual({ kind: "not_found" })
        expect(res.get(key2)).toStrictEqual({ kind: "not_found" })
      })

      it("getMany returns found for present keys", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())

        await store.set(key1, value1)
        await store.set(key2, value2)

        const res = await store.getMany([key1, "missing", key2])

        expect(res.get(key1)).toStrictEqual({ kind: "found", value: value1 })
        expect(res.get("missing")).toStrictEqual({ kind: "not_found" })
        expect(res.get(key2)).toStrictEqual({ kind: "found", value: value2 })
      })

      it("getMany works when some keys are found and some are not_found", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())

        await store.set(key1, value1)

        const res = await store.getMany([key1, "missing1", "missing2"])

        expect(res.get(key1)).toStrictEqual({ kind: "found", value: value1 })
        expect(res.get("missing1")).toStrictEqual({ kind: "not_found" })
        expect(res.get("missing2")).toStrictEqual({ kind: "not_found" })
      })

      it("getMany de-dupes duplicate keys", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())

        await store.set(key1, value1)
        await store.set(key2, value2)

        const res = await store.getMany([key2, key1, key2, "missing", key1])

        expect(res.size).toBe(3)
        expect(res.get(key1)).toStrictEqual({ kind: "found", value: value1 })
        expect(res.get(key2)).toStrictEqual({ kind: "found", value: value2 })
        expect(res.get("missing")).toStrictEqual({ kind: "not_found" })
      })
    })

    describe("setMany semantics", () => {
      it("setMany([]) is a no-op (does not throw)", async () => {
        await store.setMany([])
      })

      it("setMany writes all provided entries", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())
        const [key3, value3] = entry(keys.three(), bytes.empty())

        await store.setMany([
          [key1, value1],
          [key2, value2],
          [key3, value3],
        ])

        const res = await store.getMany([key1, key2, key3])

        expect(res.get(key1)).toStrictEqual({ kind: "found", value: value1 })
        expect(res.get(key2)).toStrictEqual({ kind: "found", value: value2 })
        expect(res.get(key3)).toStrictEqual({ kind: "found", value: value3 })
      })

      it("setMany overwrites existing keys when provided", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const value2 = bytes.b()

        await store.set(key1, value1)

        await store.setMany([[key1, value2]])

        const res = await store.get(key1)

        expect(res).toStrictEqual({ kind: "found", value: value2 })
      })

      it("setMany accepts duplicate keys; last-write-wins for each duplicated key", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const value2 = bytes.b()

        await store.setMany([
          [key1, value1],
          [key1, value2],
        ])

        const res = await store.get(key1)

        expect(res).toStrictEqual({ kind: "found", value: value2 })
      })

      it("setMany does not mutate any input Uint8Array values", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())
        const snapshot1 = value1.slice()
        const snapshot2 = value2.slice()

        await store.setMany([
          [key1, value1],
          [key2, value2],
        ])

        expect(value1).toStrictEqual(snapshot1)
        expect(value2).toStrictEqual(snapshot2)
      })
    })

    describe("deleteMany semantics", () => {
      it("deleteMany([]) is a no-op (does not throw)", async () => {
        await store.deleteMany([])
      })

      it("deleteMany removes all provided keys", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())
        const [key3, value3] = entry(keys.three(), bytes.empty())

        await store.set(key1, value1)
        await store.set(key2, value2)
        await store.set(key3, value3)

        await store.deleteMany([key1, key2, key3])

        const res = await store.getMany([key1, key2, key3])

        expect(res.get(key1)).toStrictEqual({ kind: "not_found" })
        expect(res.get(key2)).toStrictEqual({ kind: "not_found" })
        expect(res.get(key3)).toStrictEqual({ kind: "not_found" })
      })

      it("deleteMany is idempotent (safe to call repeatedly)", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())

        await store.set(key1, value1)
        await store.set(key2, value2)

        await store.deleteMany([key1, key2])
        await store.deleteMany([key1, key2])

        const res = await store.getMany([key1, key2])

        expect(res.get(key1)).toStrictEqual({ kind: "not_found" })
        expect(res.get(key2)).toStrictEqual({ kind: "not_found" })
      })

      it("deleteMany ignores missing keys without throwing", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const key2 = "missing"

        await store.set(key1, value1)

        await store.deleteMany([key1, key2])
      })

      it("deleteMany accepts duplicate keys and behaves as if each key were deleted once", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())

        await store.set(key1, value1)

        await store.deleteMany([key1, key1, key1, "missing", "missing"])

        const res = await store.get(key1)

        expect(res).toStrictEqual({ kind: "not_found" })
      })
    })

    describe("interactions between many and single-key ops", () => {
      it("values set via set are visible via getMany", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())
        const [key3, value3] = entry(keys.three(), bytes.empty())

        await store.set(key1, value1)
        await store.set(key2, value2)
        await store.set(key3, value3)

        const res = await store.getMany([key1, key2, key3])

        expect(res.get(key1)).toStrictEqual({ kind: "found", value: value1 })
        expect(res.get(key2)).toStrictEqual({ kind: "found", value: value2 })
        expect(res.get(key3)).toStrictEqual({ kind: "found", value: value3 })
      })

      it("values set via setMany are visible via get", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())

        await store.setMany([
          [key1, value1],
          [key2, value2],
        ])

        const res1 = await store.get(key1)
        const res2 = await store.get(key2)

        expect(res1).toStrictEqual({ kind: "found", value: value1 })
        expect(res2).toStrictEqual({ kind: "found", value: value2 })
      })

      it("delete affects getMany results", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())

        await store.set(key1, value1)

        await store.delete(key1)

        const res = await store.getMany([key1])

        expect(res.get(key1)).toStrictEqual({ kind: "not_found" })
      })

      it("deleteMany affects get results", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())

        await store.set(key1, value1)

        await store.deleteMany([key1])

        const res = await store.get(key1)

        expect(res).toStrictEqual({ kind: "not_found" })
      })
    })

    describe("TTL / expiration semantics", () => {
      const jitterMs = 50

      it("supports setting TTL via set options", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        await store.set(key, value, {
          ttl: { kind: "milliseconds", milliseconds: 60000 },
        })

        const res = await store.get(key)

        expect(res).toStrictEqual({ kind: "found", value })
      })

      it("supports setting TTL via setMany options", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())

        await store.setMany(
          [
            [key1, value1],
            [key2, value2],
          ],
          { ttl: { kind: "milliseconds", milliseconds: 60000 } },
        )

        const res = await store.getMany([key1, key2])

        expect(res.get(key1)).toStrictEqual({ kind: "found", value: value1 })
        expect(res.get(key2)).toStrictEqual({ kind: "found", value: value2 })
      })

      it("entries expire after TTL elapses (found becomes not_found)", async () => {
        const ttlMs = 80
        const value = bytes.a()

        await store.set(keys.one(), value, {
          ttl: { kind: "milliseconds", milliseconds: ttlMs },
        })

        const res1 = await store.get(keys.one())
        expect(res1).toStrictEqual({ kind: "found", value })

        await sleep(ttlMs + jitterMs)

        const res2 = await store.get(keys.one())
        expect(res2).toStrictEqual({ kind: "not_found" })
      })

      it("entries without TTL do not expire", async () => {
        const value = bytes.a()

        await store.set(keys.one(), value)

        const res1 = await store.get(keys.one())
        expect(res1).toStrictEqual({ kind: "found", value })

        await sleep(150)

        const res2 = await store.get(keys.one())
        expect(res2).toStrictEqual({ kind: "found", value })
      })

      it("TTL overwrite: updating a key with new TTL replaces the old TTL", async () => {
        const oldTtlMs = 200
        const newTtlMs = 40

        const [key, value] = entry(keys.one(), bytes.a())

        await store.set(key, value, {
          ttl: { kind: "milliseconds", milliseconds: oldTtlMs },
        })
        await store.set(key, value, {
          ttl: { kind: "milliseconds", milliseconds: newTtlMs },
        })

        const res1 = await store.get(key)
        expect(res1).toStrictEqual({ kind: "found", value })

        await sleep(newTtlMs + jitterMs)

        const res2 = await store.get(key)
        expect(res2).toStrictEqual({ kind: "not_found" })
      })

      it("TTL overwrite: updating a key without TTL preserves the existing TTL", async () => {
        const key = keys.one()
        const value = bytes.a()
        const ttlMs = 60

        await store.set(key, value, {
          ttl: { kind: "milliseconds", milliseconds: ttlMs },
        })

        await store.set(key, value)

        await sleep(ttlMs + jitterMs)

        const res = await store.get(key)

        expect(res).toStrictEqual({ kind: "not_found" })
      })

      it("delete works regardless of TTL state", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        await store.set(key, value, {
          ttl: { kind: "milliseconds", milliseconds: 100000 },
        })

        await store.delete(key)

        const res = await store.get(key)
        expect(res).toStrictEqual({ kind: "not_found" })
      })

      it("has returns false after TTL expires", async () => {
        const ttlMs = 80
        const [key, value] = entry(keys.one(), bytes.a())

        await store.set(key, value, {
          ttl: { kind: "milliseconds", milliseconds: ttlMs },
        })

        expect(await store.has(key)).toBe(true)

        await sleep(ttlMs + jitterMs)

        expect(await store.has(key)).toBe(false)
      })
    })

    describe("edge cases & robustness", () => {
      it("handles empty Uint8Array values (length 0) correctly", async () => {
        const [key, value] = entry(keys.one(), bytes.empty())

        await store.set(key, value)

        const res = await store.get(key)

        expect(res).toStrictEqual({ kind: "found", value })
      })

      it("handles values containing null bytes (0x00) correctly", async () => {
        const value = new Uint8Array([0, 0, 0])
        const [key] = entry(keys.one(), value)

        await store.set(key, value)

        const res = await store.get(key)

        expect(res).toStrictEqual({ kind: "found", value })
      })

      it("handles large values (within adapter limits) correctly", async () => {
        const value = new Uint8Array(1 * 1024 * 1024)
        value[0] = 1
        value[value.length - 1] = 2

        const [key] = entry("largeKey", value)

        await store.set(key, value)

        const res = await store.get(key)

        expect(res.kind).toBe("found")
        if (res.kind !== "found") return

        expect(res.value.byteLength).toBe(value.byteLength)
        expect(res.value[0]).toBe(1)
        expect(res.value[res.value.length - 1]).toBe(2)
      })

      it("handles keys with unusual characters without corruption", async () => {
        const weirdKey = "weird: key/with?strange#chars%and spaces"
        const [key, value] = entry(weirdKey, bytes.a())

        await store.set(key, value)

        const res = await store.get(key)

        expect(res).toStrictEqual({ kind: "found", value })
      })

      it("does not throw on repeated operations across many keys (stability smoke test)", async () => {
        const entries: KvEntry<Uint8Array>[] = []

        for (let i = 0; i < 100; i++) {
          entries.push([`key${i}`, bytes.a()])
        }

        await store.setMany(entries)

        const keysArr = entries.map((e) => e[0])

        const res = await store.getMany(keysArr)

        expect(res.size).toBe(100)
      })

      it("handles very long keys correctly", async () => {
        const longKey = `k:${"a".repeat(4096)}`
        const [key, value] = entry(longKey, bytes.a())

        await store.set(key, value)

        const res = await store.get(key)

        expect(res).toStrictEqual({ kind: "found", value })
      })

      it("handles Unicode keys (emoji, combining marks, and non-Latin scripts) correctly", async () => {
        const complexUnicodeKey = "lang:العربية:中文:हिन्दी:😀:e\u0301:\t"

        const [key, value] = entry(complexUnicodeKey, bytes.b())

        await store.set(key, value)

        const res = await store.get(key)

        expect(res).toStrictEqual({ kind: "found", value })
      })
    })

    describe("concurrency smoke tests", () => {
      it("concurrent sets to different keys are all visible", async () => {
        const [key1, value1] = entry(keys.one(), bytes.a())
        const [key2, value2] = entry(keys.two(), bytes.b())
        const [key3, value3] = entry(keys.three(), bytes.empty())

        await Promise.all([
          store.set(key1, value1),
          store.set(key2, value2),
          store.set(key3, value3),
        ])

        const res = await store.getMany([key1, key2, key3])

        expect(res.get(key1)).toStrictEqual({ kind: "found", value: value1 })
        expect(res.get(key2)).toStrictEqual({ kind: "found", value: value2 })
        expect(res.get(key3)).toStrictEqual({ kind: "found", value: value3 })
      })

      it("concurrent overwrites do not throw and end with one of the written values", async () => {
        const [key, value1] = entry(keys.one(), bytes.a())
        const value2 = bytes.b()

        await Promise.all([store.set(key, value1), store.set(key, value2)])

        const res = await store.get(key)

        expect(res.kind).toBe("found")
        if (res.kind !== "found") return

        expect([value1, value2]).toContainEqual(res.value)
      })

      it("set racing with delete does not throw and results in either found or not_found", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        await Promise.all([store.set(key, value), store.delete(key)])

        const res = await store.get(key)

        expect(res.kind === "found" || res.kind === "not_found").toBe(true)
        if (res.kind === "found") {
          expect(res.value).toStrictEqual(value)
        }
      })
    })
  })
}
