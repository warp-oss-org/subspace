import { FakeClock } from "@subspace/clock"
import { MemoryBytesKeyValueStore } from "../../memory-bytes-kv-store"

describe("MemoryBytesKeyValueStore (behavior)", () => {
  let clock: FakeClock
  let store: MemoryBytesKeyValueStore

  beforeEach(() => {
    clock = new FakeClock()
  })

  describe("maxEntries", () => {
    it("throws when max entries exceeded on set", async () => {
      store = new MemoryBytesKeyValueStore({ clock }, { maxEntries: 2 })

      await store.set("a", new Uint8Array([1]))
      await store.set("b", new Uint8Array([2]))

      await expect(store.set("c", new Uint8Array([3]))).rejects.toThrow(
        "max entries (2) exceeded",
      )
    })

    it("allows overwrite when at max entries", async () => {
      store = new MemoryBytesKeyValueStore({ clock }, { maxEntries: 2 })

      await store.set("a", new Uint8Array([1]))
      await store.set("b", new Uint8Array([2]))

      await store.set("a", new Uint8Array([99]))

      const res = await store.get("a")
      expect(res).toEqual({ kind: "found", value: new Uint8Array([99]) })
    })

    it("throws when max entries exceeded on setMany", async () => {
      store = new MemoryBytesKeyValueStore({ clock }, { maxEntries: 2 })

      await expect(
        store.setMany([
          ["a", new Uint8Array([1])],
          ["b", new Uint8Array([2])],
          ["c", new Uint8Array([3])],
        ]),
      ).rejects.toThrow("max entries (2) exceeded")
    })

    it("purges expired entries before enforcing max", async () => {
      store = new MemoryBytesKeyValueStore({ clock }, { maxEntries: 2 })

      await store.set("a", new Uint8Array([1]), {
        ttl: { kind: "milliseconds", milliseconds: 100 },
      })
      await store.set("b", new Uint8Array([2]), {
        ttl: { kind: "milliseconds", milliseconds: 100 },
      })

      clock.advance(150)

      await store.set("c", new Uint8Array([3]))

      const res = await store.get("c")
      expect(res).toEqual({ kind: "found", value: new Uint8Array([3]) })
    })
  })

  describe("TTL preservation", () => {
    it("set without TTL preserves existing TTL", async () => {
      store = new MemoryBytesKeyValueStore({ clock }, {})

      await store.set("a", new Uint8Array([1]), {
        ttl: { kind: "milliseconds", milliseconds: 200 },
      })
      await store.set("a", new Uint8Array([2]))

      clock.advance(150)

      const res = await store.get("a")
      expect(res).toEqual({ kind: "found", value: new Uint8Array([2]) })

      clock.advance(100)

      const res2 = await store.get("a")
      expect(res2).toEqual({ kind: "not_found" })
    })

    it("set with TTL replaces existing TTL", async () => {
      store = new MemoryBytesKeyValueStore({ clock }, {})

      await store.set("a", new Uint8Array([1]), {
        ttl: { kind: "milliseconds", milliseconds: 200 },
      })
      await store.set("a", new Uint8Array([2]), {
        ttl: { kind: "milliseconds", milliseconds: 50 },
      })

      clock.advance(75)

      const res = await store.get("a")
      expect(res).toEqual({ kind: "not_found" })
    })
  })
})
