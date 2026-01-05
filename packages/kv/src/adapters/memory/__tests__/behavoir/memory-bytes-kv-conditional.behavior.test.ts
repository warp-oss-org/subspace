import { FakeClock } from "@subspace/clock"
import { MemoryBytesKeyValueStoreConditional } from "../../memory-bytes-kv-conditional"

describe("MemoryBytesKeyValueStoreConditional (behavior)", () => {
  let clock: FakeClock
  let store: MemoryBytesKeyValueStoreConditional

  beforeEach(() => {
    clock = new FakeClock()
  })

  describe("maxEntries", () => {
    it("throws when max entries exceeded on setIfNotExists", async () => {
      store = new MemoryBytesKeyValueStoreConditional({ clock }, { maxEntries: 2 })

      await store.setIfNotExists("a", new Uint8Array([1]))
      await store.setIfNotExists("b", new Uint8Array([2]))

      await expect(store.setIfNotExists("c", new Uint8Array([3]))).rejects.toThrow(
        "max entries (2) exceeded",
      )
    })

    it("purges expired entries before enforcing max", async () => {
      store = new MemoryBytesKeyValueStoreConditional({ clock }, { maxEntries: 2 })

      await store.set("a", new Uint8Array([1]), {
        ttl: { kind: "milliseconds", milliseconds: 100 },
      })
      await store.set("b", new Uint8Array([2]), {
        ttl: { kind: "milliseconds", milliseconds: 100 },
      })

      clock.advance(150)

      const res = await store.setIfNotExists("c", new Uint8Array([3]))
      expect(res).toEqual({ kind: "written" })
    })
  })

  describe("TTL preservation", () => {
    it("setIfExists without TTL preserves existing TTL", async () => {
      store = new MemoryBytesKeyValueStoreConditional({ clock }, {})

      await store.set("a", new Uint8Array([1]), {
        ttl: { kind: "milliseconds", milliseconds: 200 },
      })
      await store.setIfExists("a", new Uint8Array([2]))

      clock.advance(150)

      const res = await store.get("a")
      expect(res).toEqual({ kind: "found", value: new Uint8Array([2]) })

      clock.advance(100)

      const res2 = await store.get("a")
      expect(res2).toEqual({ kind: "not_found" })
    })

    it("setIfExists with TTL replaces existing TTL", async () => {
      store = new MemoryBytesKeyValueStoreConditional({ clock }, {})

      await store.set("a", new Uint8Array([1]), {
        ttl: { kind: "milliseconds", milliseconds: 200 },
      })
      await store.setIfExists("a", new Uint8Array([2]), {
        ttl: { kind: "milliseconds", milliseconds: 50 },
      })

      clock.advance(75)

      const res = await store.get("a")
      expect(res).toEqual({ kind: "not_found" })
    })
  })

  describe("atomicity", () => {
    it("concurrent setIfNotExists results in exactly one written", async () => {
      store = new MemoryBytesKeyValueStoreConditional({ clock }, {})

      const [a, b] = await Promise.all([
        store.setIfNotExists("key", new Uint8Array([1])),
        store.setIfNotExists("key", new Uint8Array([2])),
      ])

      const outcomes = [a.kind, b.kind].sort()
      expect(outcomes).toEqual(["skipped", "written"])
    })

    it("concurrent setIfExists all succeed if key exists", async () => {
      store = new MemoryBytesKeyValueStoreConditional({ clock }, {})

      await store.set("key", new Uint8Array([0]))

      const [a, b] = await Promise.all([
        store.setIfExists("key", new Uint8Array([1])),
        store.setIfExists("key", new Uint8Array([2])),
      ])

      expect(a.kind).toBe("written")
      expect(b.kind).toBe("written")
    })
  })
})
