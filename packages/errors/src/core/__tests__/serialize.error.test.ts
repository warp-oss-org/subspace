import { BaseError, serializeError } from "../base-error"

describe("serializeError", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-01-15T10:30:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("BaseError instances", () => {
    it("serializes all fields", () => {
      const err = new BaseError("test error", {
        code: "TEST",
        context: { userId: "123" },
        isRetryable: true,
        isOperational: false,
      })

      const serialized = serializeError(err)

      expect(serialized).toEqual({
        name: "BaseError",
        code: "TEST",
        message: "test error",
        context: { userId: "123" },
        isOperational: false,
        timestamp: "2024-01-15T10:30:00.000Z",
      })
    })

    it("excludes stack by default", () => {
      const err = new BaseError("test", { code: "TEST" })

      const serialized = serializeError(err)

      expect(serialized.stack).toBeUndefined()
    })

    it("includes stack when requested", () => {
      const err = new BaseError("test", { code: "TEST" })

      const serialized = serializeError(err, { includeStack: true })

      expect(serialized.stack).toBeDefined()
      expect(serialized.stack).toContain("BaseError")
    })

    it("serializes cause chain recursively", () => {
      const root = new Error("root cause")
      const middle = new BaseError("middle", { code: "MID", cause: root })
      const outer = new BaseError("outer", { code: "OUTER", cause: middle })

      const serialized = serializeError(outer)

      expect(serialized.cause).toBeDefined()
      expect(serialized.cause?.code).toBe("MID")
      expect(serialized.cause?.cause).toBeDefined()
      expect(serialized.cause?.cause?.code).toBe("UNKNOWN")
      expect(serialized.cause?.cause?.message).toBe("root cause")
    })

    it("omits cause property when undefined", () => {
      const err = new BaseError("no cause", { code: "TEST" })

      const serialized = serializeError(err)

      expect("cause" in serialized).toBe(false)
    })

    it("omits stack property when not requested", () => {
      const err = new BaseError("test", { code: "TEST" })

      const serialized = serializeError(err)

      expect("stack" in serialized).toBe(false)
    })

    it("omits stack property when stack is empty", () => {
      const err = new BaseError("test", { code: "TEST" })

      err.stack = ""

      const serialized = serializeError(err, { includeStack: true })

      expect("stack" in serialized).toBe(false)
    })
  })

  describe("standard Error instances", () => {
    it("serializes with code UNKNOWN", () => {
      const err = new Error("standard error")

      const serialized = serializeError(err)

      expect(serialized.code).toBe("UNKNOWN")
    })

    it("sets isOperational to false", () => {
      const err = new Error("unexpected")

      const serialized = serializeError(err)

      expect(serialized.isOperational).toBe(false)
    })

    it("preserves error subclass name", () => {
      const err = new TypeError("not a function")

      const serialized = serializeError(err)

      expect(serialized.name).toBe("TypeError")
    })

    it("handles Error with cause", () => {
      const cause = new Error("root")
      const err = new Error("wrapper", { cause })

      const serialized = serializeError(err)

      expect(serialized.cause).toBeDefined()
      expect(serialized.cause?.message).toBe("root")
    })
  })

  describe("non-Error values", () => {
    it("wraps string as message", () => {
      const serialized = serializeError("something went wrong")

      expect(serialized.message).toBe("something went wrong")
      expect(serialized.name).toBe("NonErrorThrown")
    })

    it("wraps object in context.value", () => {
      const obj = { foo: "bar", num: 42 }

      const serialized = serializeError(obj)

      expect(serialized.context).toEqual({ value: obj })
      expect(serialized.message).toBe("Unknown error")
    })

    it("handles null", () => {
      const serialized = serializeError(null)

      expect(serialized.name).toBe("NonErrorThrown")
      expect(serialized.context).toEqual({ value: null })
    })

    it("handles undefined", () => {
      const serialized = serializeError(undefined)

      expect(serialized.name).toBe("NonErrorThrown")
      expect(serialized.context).toEqual({ value: undefined })
    })

    it("sets isOperational to false", () => {
      const serialized = serializeError({ random: "object" })

      expect(serialized.isOperational).toBe(false)
    })
  })
})
