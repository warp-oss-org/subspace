import { BaseError } from "../../base-error"
import { toAppError } from "../to-app-error"

describe("toAppError", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-01-15T10:30:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("BaseError input", () => {
    it("returns same instance unchanged", () => {
      const err = new BaseError("original", { code: "ORIG", context: { id: 1 } })
      const result = toAppError(err)

      expect(result).toBe(err)
    })
  })

  describe("standard Error input", () => {
    it("wraps in BaseError", () => {
      const err = new Error("standard")
      const result = toAppError(err)

      expect(result).toBeInstanceOf(BaseError)
    })

    it("preserves original message", () => {
      const err = new Error("original message")
      const result = toAppError(err)

      expect(result.message).toBe("original message")
    })

    it("sets original error as cause", () => {
      const err = new Error("standard")
      const result = toAppError(err)

      expect(result.cause).toBe(err)
    })

    it("uses fallback code", () => {
      const err = new Error("standard")
      const result = toAppError(err)

      expect(result.code).toBe("UNKNOWN")
    })

    it("uses custom fallback code when provided", () => {
      const err = new Error("db failed")
      const result = toAppError(err, "DB_ERROR")

      expect(result.code).toBe("DB_ERROR")
    })

    it("sets isOperational to false", () => {
      const err = new Error("unexpected")
      const result = toAppError(err)

      expect(result.isOperational).toBe(false)
    })
  })

  describe("string input", () => {
    it("uses string as message", () => {
      const result = toAppError("something went wrong")

      expect(result.message).toBe("something went wrong")
    })

    it("sets empty context", () => {
      const result = toAppError("oops")

      expect(result.context).toEqual({})
    })

    it("sets isOperational to false", () => {
      const result = toAppError("oops")

      expect(result.isOperational).toBe(false)
    })
  })

  describe("other values", () => {
    it("wraps object in context.value", () => {
      const obj = { foo: "bar", num: 42 }
      const result = toAppError(obj)

      expect(result.context).toEqual({ value: obj })
    })

    it("wraps null in context.value", () => {
      const result = toAppError(null)

      expect(result.context).toEqual({ value: null })
    })

    it("wraps undefined in context.value", () => {
      const result = toAppError(undefined)

      expect(result.context).toEqual({ value: undefined })
    })

    it("sets message to 'Unknown error'", () => {
      const result = toAppError({ some: "object" })

      expect(result.message).toBe("Unknown error")
    })

    it("sets isOperational to false", () => {
      const result = toAppError({ some: "object" })

      expect(result.isOperational).toBe(false)
    })
  })
})
