import type { EvictionMap } from "../eviction-map"

export function runEvictionMapContractTests(
  name: string,
  createMap: () => EvictionMap<string, unknown>,
) {
  describe(`${name} (contract)`, () => {
    let map: EvictionMap<string, unknown>

    beforeEach(() => {
      map = createMap()
    })

    describe("empty map basics", () => {
      it("get returns undefined for missing key", () => {
        expect(map.get("missing")).toBeUndefined()
      })

      it("has returns false for missing key", () => {
        expect(map.has("missing")).toBe(false)
      })

      it("delete returns false for missing key", () => {
        expect(map.delete("missing")).toBe(false)
      })

      it("victim returns undefined when empty", () => {
        expect(map.victim()).toBeUndefined()
      })

      it("size returns 0 when empty", () => {
        expect(map.size()).toBe(0)
      })
    })

    describe("set / get / has / size", () => {
      it("set inserts and get returns inserted value", () => {
        map.set("a", 1)

        expect(map.get("a")).toBe(1)
      })

      it("has returns true for inserted key", () => {
        map.set("a", 1)

        expect(map.has("a")).toBe(true)
      })

      it("size increments when inserting a new key", () => {
        expect(map.size()).toBe(0)

        map.set("a", 1)

        expect(map.size()).toBe(1)

        map.set("b", 2)

        expect(map.size()).toBe(2)
      })

      it("set overwrites value for existing key", () => {
        map.set("a", 1)

        map.set("a", 2)

        expect(map.get("a")).toBe(2)
      })

      it("size does not change when overwriting an existing key", () => {
        map.set("a", 1)

        const before = map.size()

        map.set("a", 2)

        expect(map.size()).toBe(before)
      })
    })

    describe("delete semantics", () => {
      it("delete removes an existing key and returns true", () => {
        map.set("a", 1)

        expect(map.delete("a")).toBe(true)
      })

      it("after delete, get returns undefined and has returns false", () => {
        map.set("a", 1)

        map.delete("a")

        expect(map.get("a")).toBeUndefined()
        expect(map.has("a")).toBe(false)
      })

      it("size decrements when deleting an existing key", () => {
        map.set("a", 1)
        map.set("b", 2)

        expect(map.size()).toBe(2)

        map.delete("a")

        expect(map.size()).toBe(1)
      })

      it("deleting the same key twice returns false the second time", () => {
        map.set("a", 1)

        expect(map.delete("a")).toBe(true)
        expect(map.delete("a")).toBe(false)
      })
    })

    describe("victim semantics", () => {
      it("victim returns some inserted key when non-empty", () => {
        map.set("a", 1)
        map.set("b", 2)

        const v = map.victim()

        expect(v).toBeDefined()

        expect(["a", "b"]).toContain(v)
      })

      it("victim does not mutate size", () => {
        map.set("a", 1)
        map.set("b", 2)

        const before = map.size()

        map.victim()

        expect(map.size()).toBe(before)
      })

      it("victim does not remove the returned key (delete required)", () => {
        map.set("a", 1)

        map.set("b", 2)

        const v = map.victim()

        expect(v).toBeDefined()

        if (v === undefined) return

        expect(map.has(v)).toBe(true)
        expect(map.get(v)).toBeDefined()
      })

      it("after deleting the victim, victim returns a different key if entries remain", () => {
        map.set("a", 1)

        map.set("b", 2)

        const first = map.victim()

        expect(first).toBeDefined()

        if (first === undefined) return

        map.delete(first)

        const second = map.victim()

        expect(second).toBeDefined()

        if (second === undefined) return

        expect(second).not.toBe(first)
      })
    })

    describe("ordering side effects are allowed but must be consistent", () => {
      it("get may update ordering but must not change size", () => {
        map.set("a", 1)

        map.set("b", 2)

        const before = map.size()

        void map.get("a")

        expect(map.size()).toBe(before)
      })

      it("set may update ordering but must not change size on overwrite", () => {
        map.set("a", 1)

        const before = map.size()

        map.set("a", 2)

        expect(map.size()).toBe(before)
      })

      it("delete must remove the key regardless of ordering rules", () => {
        map.set("a", 1)

        map.set("b", 2)

        void map.get("a")

        map.set("b", 3)

        map.victim()

        expect(map.delete("a")).toBe(true)
        expect(map.has("a")).toBe(false)
        expect(map.get("a")).toBeUndefined()
      })
    })

    describe("edge cases", () => {
      it("supports empty string keys", () => {
        const map = createMap()

        map.set("", 1)

        expect(map.has("")).toBe(true)
        expect(map.get("")).toBe(1)
        expect(map.delete("")).toBe(true)
        expect(map.has("")).toBe(false)
      })

      it("supports keys with unicode characters", () => {
        const key = "lang:العربية:中文:हिन्दी"

        map.set(key, 123)

        expect(map.get(key)).toBe(123)
        expect(map.has(key)).toBe(true)
        expect(map.delete(key)).toBe(true)
        expect(map.has(key)).toBe(false)
      })

      it("supports many inserts and deletes without throwing", () => {
        for (let i = 0; i < 500; i++) {
          map.set(`k:${i}`, i)
        }

        expect(map.size()).toBe(500)

        for (let i = 0; i < 100; i++) {
          void map.get(`k:${i}`)
        }

        for (let i = 0; i < 250; i++) {
          expect(map.delete(`k:${i}`)).toBe(true)
        }

        expect(map.size()).toBe(250)

        const v = map.victim()

        expect(v).toBeDefined()
      })
    })
  })
}
