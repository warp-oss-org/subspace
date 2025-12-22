import { LruMemoryMap } from "../lru-memory-map"

describe("LruMemoryMap (behavior)", () => {
  let map: LruMemoryMap<string, number>

  beforeEach(() => {
    map = new LruMemoryMap()
  })

  describe("victim selection (LRU)", () => {
    it("victim is the least-recently-used key after inserts", () => {
      map.set("a", 1)
      map.set("b", 2)
      map.set("c", 3)

      const victim = map.victim()
      expect(victim).toBe("a")
    })

    it("get touches key: recently read key is not the next victim", () => {
      map.set("a", 1)
      map.set("b", 2)
      map.set("c", 3)

      expect(map.get("a")).toBe(1)

      const victim = map.victim()
      expect(victim).toBe("b")
    })

    it("set touches key: updating an existing key counts as recent use", () => {
      map.set("a", 1)
      map.set("b", 2)
      map.set("c", 3)

      map.set("a", 10)

      const victim = map.victim()
      expect(victim).toBe("b")
      expect(map.get("a")).toBe(10)
    })
  })

  describe("overwrite and ordering", () => {
    it("overwriting a key updates its recency (it becomes most-recent)", () => {
      map.set("a", 1)
      map.set("b", 2)
      map.set("c", 3)

      map.set("a", 10)

      const victim = map.victim()
      expect(victim).toBe("b")
    })

    it("overwriting does not change size", () => {
      map.set("a", 1)
      map.set("b", 2)

      expect(map.size()).toBe(2)

      map.set("a", 10)

      expect(map.size()).toBe(2)
    })
  })

  describe("deletes and ordering", () => {
    it("deleting the current victim updates victim to the next LRU key", () => {
      map.set("a", 1)
      map.set("b", 2)
      map.set("c", 3)

      expect(map.victim()).toBe("a")

      expect(map.delete("a")).toBe(true)

      expect(map.victim()).toBe("b")
    })

    it("deleting a non-victim key does not corrupt ordering", () => {
      map.set("a", 1)
      map.set("b", 2)
      map.set("c", 3)

      expect(map.victim()).toBe("a")

      expect(map.delete("b")).toBe(true)

      expect(map.victim()).toBe("a")

      expect(map.delete("a")).toBe(true)
      expect(map.victim()).toBe("c")
    })
  })

  describe("stability and determinism", () => {
    it("with a deterministic insertion and access pattern, victim is deterministic", () => {
      const run = () => {
        map.set("a", 1)
        map.set("b", 2)
        map.set("c", 3)
        void map.get("a")
        map.delete("b")
        map.set("d", 4)

        return map.victim()
      }

      const first = run()

      map = new LruMemoryMap()

      const second = run()

      expect(first).toBe("c")
      expect(second).toBe("c")
    })
  })
})
