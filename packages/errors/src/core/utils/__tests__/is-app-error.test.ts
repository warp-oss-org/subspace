import { BaseError } from "../../base-error"
import { isAppError } from "../is-app-error"

describe("isAppError", () => {
  describe("returns true", () => {
    it("for BaseError instance", () => {
      const err = new BaseError("test", { code: "TEST" })

      expect(isAppError(err)).toBe(true)
    })

    it("for subclass of BaseError", () => {
      class CustomError extends BaseError<"CUSTOM"> {
        constructor(message: string) {
          super(message, { code: "CUSTOM" })
        }
      }
      const err = new CustomError("test")

      expect(isAppError(err)).toBe(true)
    })

    it("for duck-typed object with all fields", () => {
      const duckTyped = {
        name: "DuckError",
        message: "quack",
        code: "DUCK",
        context: { pond: "central" },
        isRetryable: false,
        isOperational: true,
        timestamp: new Date(),
      }

      expect(isAppError(duckTyped)).toBe(true)
    })
  })

  describe("returns false", () => {
    it("for null", () => {
      expect(isAppError(null)).toBe(false)
    })

    it("for undefined", () => {
      expect(isAppError(undefined)).toBe(false)
    })

    it("for string", () => {
      expect(isAppError("error")).toBe(false)
    })

    it("for number", () => {
      expect(isAppError(500)).toBe(false)
    })

    it("for standard Error", () => {
      expect(isAppError(new Error("standard"))).toBe(false)
    })

    it("for object missing code", () => {
      const obj = {
        name: "Err",
        message: "msg",
        context: {},
        isRetryable: false,
        isOperational: true,
        timestamp: new Date(),
      }

      expect(isAppError(obj)).toBe(false)
    })

    it("for object missing context", () => {
      const obj = {
        name: "Err",
        message: "msg",
        code: "TEST",
        isRetryable: false,
        isOperational: true,
        timestamp: new Date(),
      }

      expect(isAppError(obj)).toBe(false)
    })

    it("for object missing isRetryable", () => {
      const obj = {
        name: "Err",
        message: "msg",
        code: "TEST",
        context: {},
        isOperational: true,
        timestamp: new Date(),
      }

      expect(isAppError(obj)).toBe(false)
    })

    it("for object missing isOperational", () => {
      const obj = {
        name: "Err",
        message: "msg",
        code: "TEST",
        context: {},
        isRetryable: false,
        timestamp: new Date(),
      }

      expect(isAppError(obj)).toBe(false)
    })

    it("for object missing timestamp", () => {
      const obj = {
        name: "Err",
        message: "msg",
        code: "TEST",
        context: {},
        isRetryable: false,
        isOperational: true,
      }

      expect(isAppError(obj)).toBe(false)
    })

    it("for object with invalid timestamp", () => {
      const obj = {
        name: "Err",
        message: "msg",
        code: "TEST",
        context: {},
        isRetryable: false,
        isOperational: true,
        timestamp: new Date("invalid"),
      }

      expect(isAppError(obj)).toBe(false)
    })

    it("for object missing message", () => {
      const obj = {
        name: "Err",
        code: "TEST",
        context: {},
        isRetryable: false,
        isOperational: true,
        timestamp: new Date(),
      }

      expect(isAppError(obj)).toBe(false)
    })

    it("for object missing name", () => {
      const obj = {
        message: "msg",
        code: "TEST",
        context: {},
        isRetryable: false,
        isOperational: true,
        timestamp: new Date(),
      }

      expect(isAppError(obj)).toBe(false)
    })
  })
})
