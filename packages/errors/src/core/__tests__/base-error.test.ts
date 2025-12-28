import { BaseError } from "../base-error"

describe("BaseError", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-01-15T10:30:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("construction", () => {
    it("creates error with required fields", () => {
      const err = new BaseError("Something went wrong", { code: "TEST_ERROR" })

      expect(err.message).toBe("Something went wrong")
      expect(err.code).toBe("TEST_ERROR")
    })

    it("sets name to constructor name", () => {
      const err = new BaseError("test", { code: "TEST" })

      expect(err.name).toBe("BaseError")
    })

    it("defaults context to empty object", () => {
      const err = new BaseError("test", { code: "TEST" })

      expect(err.context).toEqual({})
    })

    it("defaults isRetryable to false", () => {
      const err = new BaseError("test", { code: "TEST" })

      expect(err.isRetryable).toBe(false)
    })

    it("defaults isOperational to true", () => {
      const err = new BaseError("test", { code: "TEST" })

      expect(err.isOperational).toBe(true)
    })

    it("sets timestamp to current time", () => {
      const err = new BaseError("test", { code: "TEST" })

      expect(err.timestamp).toEqual(new Date("2024-01-15T10:30:00.000Z"))
    })

    it("accepts optional context", () => {
      const err = new BaseError("test", {
        code: "TEST",
        context: { userId: "123", action: "save" },
      })

      expect(err.context).toEqual({ userId: "123", action: "save" })
    })

    it("accepts optional cause", () => {
      const cause = new Error("root cause")
      const err = new BaseError("wrapped", { code: "TEST", cause })

      expect(err.cause).toBe(cause)
    })

    it("accepts optional isRetryable", () => {
      const err = new BaseError("timeout", { code: "TIMEOUT", isRetryable: true })

      expect(err.isRetryable).toBe(true)
    })

    it("accepts optional isOperational", () => {
      const err = new BaseError("invariant", { code: "BUG", isOperational: false })

      expect(err.isOperational).toBe(false)
    })

    it("freezes context to prevent mutation", () => {
      const err = new BaseError("test", { code: "TEST", context: { foo: "bar" } })

      expect(Object.isFrozen(err.context)).toBe(true)
    })

    it("has a stack trace", () => {
      const err = new BaseError("test", { code: "TEST" })

      expect(err.stack).toBeDefined()
      expect(err.stack).toContain("BaseError")
    })

    it("defaults context to empty frozen object when undefined", () => {
      const err = new BaseError("test", { code: "TEST" })

      expect(err.context).toEqual({})
      expect(Object.isFrozen(err.context)).toBe(true)
    })
  })

  describe("type safety", () => {
    it("preserves generic code type", () => {
      type MyCode = "USER_NOT_FOUND" | "EMAIL_TAKEN"
      const err = new BaseError<MyCode>("not found", { code: "USER_NOT_FOUND" })

      const code: MyCode = err.code
      expect(code).toBe("USER_NOT_FOUND")
    })
  })

  describe("inheritance", () => {
    it("is instanceof Error", () => {
      const err = new BaseError("test", { code: "TEST" })

      expect(err instanceof Error).toBe(true)
    })

    it("is instanceof BaseError", () => {
      const err = new BaseError("test", { code: "TEST" })

      expect(err instanceof BaseError).toBe(true)
    })
  })

  describe("toJSON", () => {
    it("returns serialized error", () => {
      const err = new BaseError("test error", {
        code: "TEST",
        context: { id: 123 },
      })

      const json = err.toJSON()

      expect(json).toEqual({
        name: "BaseError",
        code: "TEST",
        message: "test error",
        context: { id: 123 },
        isOperational: true,
        timestamp: "2024-01-15T10:30:00.000Z",
      })
    })
  })
})
