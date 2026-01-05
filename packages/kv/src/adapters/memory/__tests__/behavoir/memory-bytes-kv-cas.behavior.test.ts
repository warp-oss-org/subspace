import { FakeClock } from "@subspace/clock"
import { MemoryBytesKeyValueStoreCas } from "../../memory-bytes-kv-cas"

describe("MemoryBytesKeyValueStoreCas (behavior)", () => {
  let clock: FakeClock
  let store: MemoryBytesKeyValueStoreCas

  beforeEach(() => {
    clock = new FakeClock()
  })

  describe("maxEntries", () => {
    it("throws when max entries exceeded on set", async () => {
      store = new MemoryBytesKeyValueStoreCas({ clock }, { maxEntries: 2 })

      await store.set("a", new Uint8Array([1]))
      await store.set("b", new Uint8Array([2]))

      await expect(store.set("c", new Uint8Array([3]))).rejects.toThrow(
        "max entries (2) exceeded",
      )
    })

    it("purges expired entries before enforcing max", async () => {
      store = new MemoryBytesKeyValueStoreCas({ clock }, { maxEntries: 2 })

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
      store = new MemoryBytesKeyValueStoreCas({ clock }, {})

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

    it("setIfVersion without TTL preserves existing TTL", async () => {
      store = new MemoryBytesKeyValueStoreCas({ clock }, {})

      await store.set("a", new Uint8Array([1]), {
        ttl: { kind: "milliseconds", milliseconds: 200 },
      })

      const versioned = await store.getVersioned("a")
      if (versioned.kind !== "found") throw new Error("expected found")

      await store.setIfVersion("a", new Uint8Array([2]), versioned.version)

      clock.advance(150)

      const res = await store.get("a")
      expect(res).toEqual({ kind: "found", value: new Uint8Array([2]) })

      clock.advance(100)

      const res2 = await store.get("a")
      expect(res2).toEqual({ kind: "not_found" })
    })

    it("setIfVersion with TTL replaces existing TTL", async () => {
      store = new MemoryBytesKeyValueStoreCas({ clock }, {})

      await store.set("a", new Uint8Array([1]), {
        ttl: { kind: "milliseconds", milliseconds: 200 },
      })

      const versioned = await store.getVersioned("a")
      if (versioned.kind !== "found") throw new Error("expected found")

      await store.setIfVersion("a", new Uint8Array([2]), versioned.version, {
        ttl: { kind: "milliseconds", milliseconds: 50 },
      })

      clock.advance(75)

      const res = await store.get("a")
      expect(res).toEqual({ kind: "not_found" })
    })
  })

  describe("version semantics", () => {
    it("version is opaque string", async () => {
      store = new MemoryBytesKeyValueStoreCas({ clock }, {})

      await store.set("a", new Uint8Array([1]))

      const res = await store.getVersioned("a")
      if (res.kind !== "found") throw new Error("expected found")

      expect(typeof res.version).toBe("string")
      expect(res.version.length).toBeGreaterThan(0)
    })

    it("set increments version", async () => {
      store = new MemoryBytesKeyValueStoreCas({ clock }, {})

      await store.set("a", new Uint8Array([1]))
      const v1 = await store.getVersioned("a")

      await store.set("a", new Uint8Array([2]))
      const v2 = await store.getVersioned("a")

      if (v1.kind !== "found" || v2.kind !== "found") throw new Error("expected found")

      expect(v1.version).not.toBe(v2.version)
    })

    it("setMany increments version for each key", async () => {
      store = new MemoryBytesKeyValueStoreCas({ clock }, {})

      await store.set("a", new Uint8Array([1]))
      await store.set("b", new Uint8Array([1]))

      const v1a = await store.getVersioned("a")
      const v1b = await store.getVersioned("b")

      await store.setMany([
        ["a", new Uint8Array([2])],
        ["b", new Uint8Array([2])],
      ])

      const v2a = await store.getVersioned("a")
      const v2b = await store.getVersioned("b")

      if (v1a.kind !== "found" || v1b.kind !== "found") throw new Error("expected found")
      if (v2a.kind !== "found" || v2b.kind !== "found") throw new Error("expected found")

      expect(v1a.version).not.toBe(v2a.version)
      expect(v1b.version).not.toBe(v2b.version)
    })
  })
})
