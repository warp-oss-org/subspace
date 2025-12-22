import { FifoMemoryMap } from "../fifo-memory-map"

describe("FifoEvictionMap (behavior)", () => {
  let map: FifoMemoryMap<string, number>

  beforeEach(() => {
    map = new FifoMemoryMap()
  })

  describe("victim selection (FIFO)", () => {
    it("victim is the oldest-inserted key after inserts", () => {
      map.set("a", 1)
      map.set("b", 2)
      map.set("c", 3)

      const victim = map.victim()
      expect(victim).toBe("a")
    })

    it("get does not affect victim ordering (reads do not touch)", () => {
      map.set("a", 1)
      map.set("b", 2)
      map.set("c", 3)

      expect(map.get("c")).toBe(3)
      expect(map.get("a")).toBe(1)

      const victim = map.victim()
      expect(victim).toBe("a")
    })

    it("set overwriting an existing key does not reset its insertion order (policy decision)", () => {
      map.set("a", 1)
      map.set("b", 2)
      map.set("c", 3)

      map.set("a", 10)

      const victim = map.victim()

      expect(victim).toBe("a")
      expect(map.get("a")).toBe(10)
    })
  })

  describe("overwrite and ordering", () => {
    it("overwriting does not change size", () => {
      map.set("a", 1)
      map.set("b", 2)

      expect(map.size()).toBe(2)

      map.set("a", 10)

      expect(map.size()).toBe(2)
    })

    it("victim remains stable after overwriting a non-victim key", () => {
      map.set("a", 1)
      map.set("b", 2)
      map.set("c", 3)

      const before = map.victim()
      expect(before).toBe("a")

      map.set("b", 20)

      const after = map.victim()
      expect(after).toBe("a")
      expect(map.get("b")).toBe(20)
    })
  })

  describe("deletes and ordering", () => {
    it("deleting the current victim updates victim to the next oldest key", () => {
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
    it("with deterministic insertion pattern, victim is deterministic", () => {
      const run = () => {
        map.set("a", 1)
        map.set("b", 2)
        map.set("c", 3)
        map.delete("b")
        map.set("d", 4)
        return map.victim()
      }

      const first = run()

      map = new FifoMemoryMap()

      const second = run()

      expect(first).toBe("a")
      expect(second).toBe("a")
    })
  })
})
