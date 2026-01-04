import { sleep } from "../../tests/sleep"
import { bytes, keys } from "../../tests/utils/kv-test-helpers"
import type { BytesKeyValueStoreConditional } from "../bytes-kv-store"
import { describeKvStoreContract, entry } from "./kv-store.contract"

type CreateStore = () => BytesKeyValueStoreConditional

export function describeKvConditionalContract(
  adapterName: string,
  createStore: CreateStore,
): void {
  describe(`BytesKeyValueStoreConditional Contract Tests - ${adapterName}`, () => {
    let store: BytesKeyValueStoreConditional

    beforeEach(() => {
      store = createStore()
    })

    describeKvStoreContract(adapterName, createStore)

    describe("setIfNotExists semantics", () => {
      it("writes and returns 'written' when key does not exist", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        const res = await store.setIfNotExists(key, value)

        expect(res).toStrictEqual({ kind: "written" })

        const stored = await store.get(key)
        expect(stored).toStrictEqual({ kind: "found", value })
      })

      it("returns 'skipped' and does not overwrite when key exists", async () => {
        const [key, value1] = entry(keys.one(), bytes.a())
        const value2 = bytes.b()

        await store.set(key, value1)

        const res = await store.setIfNotExists(key, value2)

        expect(res).toStrictEqual({ kind: "skipped" })

        const stored = await store.get(key)
        expect(stored).toStrictEqual({ kind: "found", value: value1 })
      })

      it("is atomic: concurrent setIfNotExists on same key results in exactly one 'written'", async () => {
        const key = keys.one()
        const value1 = bytes.a()
        const value2 = bytes.b()

        const [res1, res2] = await Promise.all([
          store.setIfNotExists(key, value1),
          store.setIfNotExists(key, value2),
        ])

        const writtenCount = [res1, res2].filter((r) => r.kind === "written").length
        const skippedCount = [res1, res2].filter((r) => r.kind === "skipped").length

        expect(writtenCount).toBe(1)
        expect(skippedCount).toBe(1)

        const stored = await store.get(key)
        expect(stored.kind).toBe("found")
        if (stored.kind === "found") {
          expect([value1, value2]).toContainEqual(stored.value)
        }
      })

      it("supports TTL option", async () => {
        const [key, value] = entry(keys.one(), bytes.a())
        const ttlMs = 80

        const res = await store.setIfNotExists(key, value, {
          ttl: { kind: "milliseconds", milliseconds: ttlMs },
        })
        expect(res).toStrictEqual({ kind: "written" })

        await sleep(ttlMs + 50)

        const stored = await store.get(key)
        expect(stored).toStrictEqual({ kind: "not_found" })
      })

      it("works after key is deleted (key no longer exists)", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        await store.set(key, value)
        await store.delete(key)

        const res = await store.setIfNotExists(key, bytes.b())

        expect(res).toStrictEqual({ kind: "written" })
      })
    })

    describe("setIfExists semantics", () => {
      it("returns 'skipped' when key does not exist", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        const res = await store.setIfExists(key, value)

        expect(res).toStrictEqual({ kind: "skipped" })

        const stored = await store.get(key)
        expect(stored).toStrictEqual({ kind: "not_found" })
      })

      it("writes and returns 'written' when key exists", async () => {
        const [key, value1] = entry(keys.one(), bytes.a())
        const value2 = bytes.b()

        await store.set(key, value1)

        const res = await store.setIfExists(key, value2)

        expect(res).toStrictEqual({ kind: "written" })

        const stored = await store.get(key)
        expect(stored).toStrictEqual({ kind: "found", value: value2 })
      })

      it("supports TTL option", async () => {
        const [key, value1] = entry(keys.one(), bytes.a())
        const value2 = bytes.b()
        const ttlMs = 80

        await store.set(key, value1)

        const res = await store.setIfExists(key, value2, {
          ttl: { kind: "milliseconds", milliseconds: ttlMs },
        })
        expect(res).toStrictEqual({ kind: "written" })

        await sleep(ttlMs + 50)

        const stored = await store.get(key)
        expect(stored).toStrictEqual({ kind: "not_found" })
      })

      it("returns 'skipped' after key is deleted", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        await store.set(key, value)
        await store.delete(key)

        const res = await store.setIfExists(key, bytes.b())

        expect(res).toStrictEqual({ kind: "skipped" })
      })
    })
  })
}
