import { BaseError } from "../../base-error"
import { createError } from "../create-error"

describe("createError", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-01-15T10:30:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("creates BaseError with code and message", () => {
    const err = createError("my_error", "Something happened")

    expect(err).toBeInstanceOf(BaseError)
    expect(err.code).toBe("my_error")
    expect(err.message).toBe("Something happened")
  })

  it("accepts optional context", () => {
    const err = createError("user_error", "Not found", {
      context: { userId: "123", action: "lookup" },
    })

    expect(err.context).toEqual({ userId: "123", action: "lookup" })
  })

  it("accepts optional cause", () => {
    const cause = new Error("Original failure")
    const err = createError("wrapped", "Wrapper", { cause })

    expect(err.cause).toBe(cause)
  })

  it("accepts optional isRetryable", () => {
    const retryable = createError("timeout", "Timed out", { isRetryable: true })
    const notRetryable = createError("invalid", "Bad input", { isRetryable: false })

    expect(retryable.isRetryable).toBe(true)
    expect(notRetryable.isRetryable).toBe(false)
  })

  it("accepts optional isOperational", () => {
    const operational = createError("validation", "Bad input", { isOperational: true })
    const notOperational = createError("invariant", "Bug", { isOperational: false })

    expect(operational.isOperational).toBe(true)
    expect(notOperational.isOperational).toBe(false)
  })

  it("preserves generic code type", () => {
    type MyCode = "foo" | "bar"
    const err = createError<MyCode>("foo", "Test")

    const code: MyCode = err.code
    expect(code).toBe("foo")
  })
})
