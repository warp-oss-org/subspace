import { BaseError } from "../../base-error"
import { errorChain } from "../error-chain"

describe("errorChain", () => {
  describe("basic chains", () => {
    it("returns single element for error without cause", () => {
      const err = new Error("solo")
      const chain = errorChain(err)

      expect(chain).toHaveLength(1)
      expect(chain[0]).toBe(err)
    })

    it("returns chain for nested causes", () => {
      const root = new Error("root")
      const middle = new Error("middle", { cause: root })
      const outer = new Error("outer", { cause: middle })

      const chain = errorChain(outer)

      expect(chain).toHaveLength(3)
      expect(chain[0]).toBe(outer)
      expect(chain[1]).toBe(middle)
      expect(chain[2]).toBe(root)
    })

    it("handles mixed Error and BaseError", () => {
      const root = new Error("standard")
      const middle = new BaseError("base", { code: "mid", cause: root })
      const outer = new Error("outer", { cause: middle })

      const chain = errorChain(outer)

      expect(chain).toHaveLength(3)
      expect(chain[0]).toBeInstanceOf(Error)
      expect(chain[1]).toBeInstanceOf(BaseError)
      expect(chain[2]).toBeInstanceOf(Error)
    })

    it("handles non-Error causes", () => {
      const err = new Error("wrapper", { cause: "string cause" })

      const chain = errorChain(err)

      expect(chain).toHaveLength(2)
      expect(chain[0]).toBe(err)
      expect(chain[1]).toBe("string cause")
    })
  })

  describe("safety", () => {
    it("detects cycles", () => {
      const a = { cause: null as unknown, message: "a" }
      const b = { cause: a, message: "b" }
      a.cause = b // cycle: a -> b -> a

      const chain = errorChain(a)

      expect(chain).toHaveLength(2)
      expect(chain[0]).toBe(a)
      expect(chain[1]).toBe(b)
    })

    it("respects maxDepth", () => {
      let current: Error = new Error("root")
      for (let i = 0; i < 9; i++) {
        current = new Error(`level-${i}`, { cause: current })
      }

      const chain = errorChain(current, 5)

      expect(chain).toHaveLength(5)
    })

    it("uses default maxDepth of 50", () => {
      let current: Error = new Error("root")
      for (let i = 0; i < 99; i++) {
        current = new Error(`level-${i}`, { cause: current })
      }

      const chain = errorChain(current)

      expect(chain).toHaveLength(50)
    })
  })

  describe("edge cases", () => {
    it("handles null input", () => {
      const chain = errorChain(null)

      expect(chain).toHaveLength(0)
    })

    it("handles undefined input", () => {
      const chain = errorChain(undefined)

      expect(chain).toHaveLength(0)
    })

    it("handles string input", () => {
      const chain = errorChain("just a string")

      expect(chain).toHaveLength(1)
      expect(chain[0]).toBe("just a string")
    })
  })
})
