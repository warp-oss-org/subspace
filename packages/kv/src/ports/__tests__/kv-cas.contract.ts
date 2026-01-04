import { sleep } from "../../tests/sleep"
import { bytes, keys } from "../../tests/utils/kv-test-helpers"
import type { BytesKeyValueStoreCas } from "../bytes-kv-store"
import { describeKvStoreContract, entry } from "./kv-store.contract"

function expectBytesEqual(actual: Uint8Array, expected: Uint8Array): void {
  expect(Buffer.from(actual)).toStrictEqual(Buffer.from(expected))
}

type CreateStore = () => BytesKeyValueStoreCas

export function describeKvCasContract(
  adapterName: string,
  createStore: CreateStore,
): void {
  describe(`BytesKeyValueStoreCas Contract Tests - ${adapterName}`, () => {
    let store: BytesKeyValueStoreCas

    beforeEach(() => {
      store = createStore()
    })

    describeKvStoreContract(adapterName, createStore)

    describe("getVersioned semantics", () => {
      it("returns not_found for absent key", async () => {
        const res = await store.getVersioned("missing")

        expect(res).toStrictEqual({ kind: "not_found" })
      })

      it("returns found with version for present key", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        await store.set(key, value)

        const res = await store.getVersioned(key)

        expect(res.kind).toBe("found")
        if (res.kind === "found") {
          expectBytesEqual(res.value, value)
          expect(typeof res.version).toBe("string")
          expect(res.version.length).toBeGreaterThan(0)
        }
      })

      it("version changes after value is updated", async () => {
        const [key, value1] = entry(keys.one(), bytes.a())
        const value2 = bytes.b()

        await store.set(key, value1)
        const res1 = await store.getVersioned(key)

        await store.set(key, value2)
        const res2 = await store.getVersioned(key)

        expect(res1.kind).toBe("found")
        expect(res2.kind).toBe("found")

        if (res1.kind === "found" && res2.kind === "found") {
          expect(res1.version).not.toBe(res2.version)
        }
      })

      it("version is stable across reads when there are no intervening writes", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        await store.set(key, value)

        const res1 = await store.getVersioned(key)
        const res2 = await store.getVersioned(key)

        expect(res1.kind).toBe("found")
        expect(res2.kind).toBe("found")

        if (res1.kind === "found" && res2.kind === "found") {
          expect(res1.version).toBe(res2.version)
        }
      })

      it("version changes on write even if the same value is written again", async () => {
        const [key, value] = entry(keys.one(), bytes.a())

        await store.set(key, value)
        const res1 = await store.getVersioned(key)

        await store.set(key, value)
        const res2 = await store.getVersioned(key)

        expect(res1.kind).toBe("found")
        expect(res2.kind).toBe("found")

        if (res1.kind === "found" && res2.kind === "found") {
          expect(res1.version).not.toBe(res2.version)
        }
      })
    })

    describe("setIfVersion semantics", () => {
      it("returns 'written' with new version when version matches", async () => {
        const [key, value1] = entry(keys.one(), bytes.a())
        const value2 = bytes.b()

        await store.set(key, value1)
        const current = await store.getVersioned(key)

        expect(current.kind).toBe("found")
        if (current.kind !== "found") return

        const res = await store.setIfVersion(key, value2, current.version)

        expect(res.kind).toBe("written")
        if (res.kind === "written") {
          expect(typeof res.version).toBe("string")
          expect(res.version).not.toBe(current.version)
        }

        const stored = await store.get(key)
        expect(stored.kind).toBe("found")
        if (stored.kind === "found") {
          expectBytesEqual(stored.value, value2)
        }

        const versioned = await store.getVersioned(key)
        expect(versioned.kind).toBe("found")
        if (res.kind === "written" && versioned.kind === "found") {
          expect(versioned.version).toBe(res.version)
        }
      })

      it("returns 'conflict' when version does not match", async () => {
        const [key, value1] = entry(keys.one(), bytes.a())
        const value2 = bytes.b()
        const value3 = new Uint8Array([7, 8, 9])

        await store.set(key, value1)
        const current = await store.getVersioned(key)

        expect(current.kind).toBe("found")
        if (current.kind !== "found") return

        await store.set(key, value2)

        const res = await store.setIfVersion(key, value3, current.version)

        expect(res).toStrictEqual({ kind: "conflict" })

        const stored = await store.get(key)

        expect(stored.kind).toBe("found")
        if (stored.kind === "found") {
          expectBytesEqual(stored.value, value2)
        }
      })

      it("returns 'not_found' when key was deleted", async () => {
        const [key, value1] = entry(keys.one(), bytes.a())
        const value2 = bytes.b()

        await store.set(key, value1)
        const current = await store.getVersioned(key)

        expect(current.kind).toBe("found")
        if (current.kind !== "found") return

        await store.delete(key)

        const res = await store.setIfVersion(key, value2, current.version)

        expect(res).toStrictEqual({ kind: "not_found" })
      })

      it("is atomic: concurrent setIfVersion with same version results in exactly one 'written'", async () => {
        const [key, value1] = entry(keys.one(), bytes.a())
        const value2 = bytes.b()
        const value3 = new Uint8Array([7, 8, 9])

        await store.set(key, value1)
        const current = await store.getVersioned(key)

        expect(current.kind).toBe("found")
        if (current.kind !== "found") return

        const [res1, res2] = await Promise.all([
          store.setIfVersion(key, value2, current.version),
          store.setIfVersion(key, value3, current.version),
        ])

        const writtenCount = [res1, res2].filter((r) => r.kind === "written").length
        const conflictCount = [res1, res2].filter((r) => r.kind === "conflict").length

        expect(writtenCount).toBe(1)
        expect(conflictCount).toBe(1)
      })

      it("supports TTL option", async () => {
        const [key, value1] = entry(keys.one(), bytes.a())
        const value2 = bytes.b()
        const ttlMs = 80

        await store.set(key, value1)
        const current = await store.getVersioned(key)

        expect(current.kind).toBe("found")
        if (current.kind !== "found") return

        const res = await store.setIfVersion(key, value2, current.version, {
          ttl: { kind: "milliseconds", milliseconds: ttlMs },
        })

        expect(res.kind).toBe("written")

        await sleep(ttlMs + 50)

        const stored = await store.get(key)
        expect(stored).toStrictEqual({ kind: "not_found" })
      })
    })
  })
}
