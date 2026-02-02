import { type AppError, BaseError, type ErrorCode } from "@subspace/errors"
import type { Logger } from "@subspace/logger"
import { mock } from "vitest-mock-extended"
import { mockContext } from "../../middleware/__tests__/mocks/context-mock"
import type { ResolvedServerOptions } from "../../server/server-options"
import type { Mock } from "../../tests/mock"
import { createErrorHandler } from "../create-error-handler"
import type { ErrorMapping } from "../errors"

describe("createErrorHandler", async () => {
  let logger: Mock<Logger>

  beforeEach(() => {
    logger = mock<Logger>()
  })

  it("creates default error handler when using error mappings", async () => {
    const mappings: Record<ErrorCode, ErrorMapping> = {
      test_error: { status: 400, message: "This is a test client error" },
    }

    const handler = createErrorHandler(
      {
        errorHandling: { kind: "mappings", config: { mappings } },
      } as ResolvedServerOptions,
      logger,
    )

    const c = mockContext({
      requestId: "req-123",
      method: "PUT",
      route: "/test-route/:id",
    })

    const error = new BaseError("Test client error", { code: "test_error" })

    const result = await handler(error, c)

    expect(logger.info).toHaveBeenCalledWith("Request failed", {
      code: "test_error",
      method: "PUT",
      op: "PUT /test-route/:id",
      requestId: "req-123",
      route: "/test-route/:id",
      status: 400,
    })

    expect(result.status).toBe(400)
    expect(result.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "test_error",
          status: 400,
          requestId: "req-123",
          message: "This is a test client error",
        }),
      }),
    )
  })

  it("creates a custom error handler when provided", async () => {
    const custom = vi.fn(() => c.text("custom", 418))

    const handler = createErrorHandler(
      {
        errorHandling: { kind: "handler", errorHandler: custom },
      } as any as ResolvedServerOptions,
      logger,
    )

    const c = mockContext({ method: "GET", path: "/x", requestId: "req-1" })
    const error = new Error("boom")

    handler(error, c)

    expect(custom).toHaveBeenCalledExactlyOnceWith(error, c)
  })

  it("formats errors into a consistent response shape", async () => {
    const mappings: Record<ErrorCode, ErrorMapping> = {
      test_error: { status: 400, message: "This is a test client error" },
    }

    const handler = createErrorHandler(
      {
        errorHandling: { kind: "mappings", config: { mappings } },
      } as ResolvedServerOptions,
      logger,
    )

    const c = mockContext({ requestId: "req-123" })
    const error = new BaseError("Test client error", { code: "test_error" })

    const result = await handler(error, c)

    expect(result.status).toBe(400)
    expect(result.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "test_error",
          status: 400,
          requestId: "req-123",
          message: "This is a test client error",
        }),
      }),
    )
  })

  it("logs 5xx errors at error level", async () => {
    const mappings: Record<ErrorCode, ErrorMapping> = {
      test_error: { status: 500, message: "Boom" },
    }

    const handler = createErrorHandler(
      {
        errorHandling: { kind: "mappings", config: { mappings } },
      } as ResolvedServerOptions,
      logger,
    )

    const c = mockContext({
      requestId: "req-123",
      method: "POST",
      route: "/fail-route",
    })

    const error = new BaseError("Boom error", { code: "test_error" })

    const result = await handler(error, c)

    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      "Request failed",
      expect.objectContaining({
        code: "test_error",
        status: 500,
        requestId: "req-123",
        method: "POST",
        route: "/fail-route",
        op: "POST /fail-route",
        err: expect.anything(),
      }),
    )
    expect(result.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "test_error",
          status: 500,
          requestId: "req-123",
          message: "Boom",
        }),
      }),
    )
  })

  it("logs 4xx errors at info level", async () => {
    const mappings: Record<ErrorCode, ErrorMapping> = {
      test_error: { status: 404, message: "Not found" },
    }

    const handler = createErrorHandler(
      {
        errorHandling: { kind: "mappings", config: { mappings } },
      } as ResolvedServerOptions,
      logger,
    )

    const c = mockContext({
      requestId: "req-321",
      method: "GET",
      route: "/not-found",
    })

    const error = new BaseError("Not found", { code: "test_error" })

    handler(error, c)

    expect(logger.info).toHaveBeenCalledExactlyOnceWith(
      "Request failed",
      expect.objectContaining({
        code: "test_error",
        status: 404,
        requestId: "req-321",
        method: "GET",
        route: "/not-found",
        op: "GET /not-found",
      }),
    )
  })

  it("does not log error objects for 4xx at error level", async () => {
    const mappings: Record<ErrorCode, ErrorMapping> = {
      test_error: { status: 400, message: "Bad request" },
    }

    const handler = createErrorHandler(
      {
        errorHandling: { kind: "mappings", config: { mappings } },
      } as ResolvedServerOptions,
      logger,
    )

    const c = mockContext({
      requestId: "req-555",
      method: "POST",
      route: "/bad-request",
    })

    const error = new BaseError("Bad request", { code: "test_error" })

    handler(error, c)

    expect(logger.info).toHaveBeenCalledExactlyOnceWith(
      "Request failed",
      expect.not.objectContaining({ err: expect.anything() }),
    )

    expect(logger.error).not.toHaveBeenCalled()
  })

  it("falls back to request path when route is not available", async () => {
    const mappings: Record<ErrorCode, ErrorMapping> = {
      test_error: { status: 400, message: "Bad request" },
    }
    const handler = createErrorHandler(
      {
        errorHandling: { kind: "mappings", config: { mappings } },
      } as ResolvedServerOptions,
      logger,
    )
    const c = mockContext({
      requestId: "req-123",
      method: "GET",
      path: "/fallback",
    })

    const error = new BaseError("Bad request", { code: "test_error" })

    handler(error, c)

    expect(logger.info).toHaveBeenCalledExactlyOnceWith(
      "Request failed",
      expect.objectContaining({
        route: "/fallback",
        op: "GET /fallback",
      }),
    )
  })

  it("uses route path when available", async () => {
    const mappings: Record<ErrorCode, ErrorMapping> = {
      test_error: { status: 400, message: "Bad request" },
    }

    const handler = createErrorHandler(
      {
        errorHandling: { kind: "mappings", config: { mappings } },
      } as ResolvedServerOptions,
      logger,
    )

    const c = mockContext({
      requestId: "req-123",
      method: "GET",
      path: "/users/1",
      route: "/users/:id",
    })

    const error = new BaseError("Bad request", { code: "test_error" })

    handler(error, c)

    expect(logger.info).toHaveBeenCalledExactlyOnceWith(
      "Request failed",
      expect.objectContaining({
        route: "/users/:id",
        op: "GET /users/:id",
      }),
    )
  })

  it("handles unknown thrown values safely", async () => {
    const mappings: Record<ErrorCode, ErrorMapping> = {
      test_error: { status: 400, message: "Bad request" },
    }

    const handler = createErrorHandler(
      {
        errorHandling: { kind: "mappings", config: { mappings } },
      } as ResolvedServerOptions,
      logger,
    )

    const c = mockContext({ requestId: "req-999" })
    const thrown = { weird: true } as any

    const result = await handler(thrown, c)

    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      "Request failed",
      expect.objectContaining({
        code: "internal_error",
        status: 500,
        requestId: "req-999",
        err: thrown,
      }),
    )
    expect(result.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "internal_error",
          status: 500,
          requestId: "req-999",
          message: "An unexpected error occurred",
        }),
      }),
    )
  })

  it('uses requestId="unknown" when context does not have requestId', async () => {
    const mappings: Record<ErrorCode, ErrorMapping> = {
      test_error: { status: 400, message: "Bad request" },
    }

    const handler = createErrorHandler(
      {
        errorHandling: { kind: "mappings", config: { mappings } },
      } as ResolvedServerOptions,
      logger,
    )

    const c = mockContext({ method: "GET", path: "/x" })
    const error = new BaseError("Bad request", { code: "test_error" })

    const result = await handler(error, c)

    expect(result.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          requestId: "unknown",
        }),
      }),
    )

    expect(logger.info).toHaveBeenCalledWith(
      "Request failed",
      expect.objectContaining({ requestId: "unknown" }),
    )
  })

  it("falls back to request path when route is blank/whitespace", async () => {
    const mappings: Record<ErrorCode, ErrorMapping> = {
      test_error: { status: 400, message: "Bad request" },
    }

    const handler = createErrorHandler(
      {
        errorHandling: { kind: "mappings", config: { mappings } },
      } as ResolvedServerOptions,
      logger,
    )

    const c = mockContext({
      requestId: "req-123",
      method: "GET",
      path: "/fallback",
      route: "   ",
    })

    const error = new BaseError("Bad request", { code: "test_error" })

    await handler(error, c)

    expect(logger.info).toHaveBeenCalledExactlyOnceWith(
      "Request failed",
      expect.objectContaining({
        route: "/fallback",
        op: "GET /fallback",
      }),
    )
  })

  it("formats non-BaseError errors into internal_error response shape", async () => {
    const mappings: Record<ErrorCode, ErrorMapping> = {
      test_error: { status: 400, message: "Bad request" },
    }

    const handler = createErrorHandler(
      {
        errorHandling: { kind: "mappings", config: { mappings } },
      } as ResolvedServerOptions,
      logger,
    )

    const c = mockContext({ requestId: "req-500", method: "GET", path: "/boom" })
    const err = new Error("boom")

    const result = await handler(err, c)

    expect(result.status).toBe(500)
    expect(result.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          status: 500,
          code: "internal_error",
          requestId: "req-500",
          message: expect.any(String),
        }),
      }),
    )

    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      "Request failed",
      expect.objectContaining({
        status: 500,
        code: "internal_error",
        requestId: "req-500",
        err,
      }),
    )
  })

  it("does not log stack objects for 4xx responses", async () => {
    const mappings: Record<ErrorCode, ErrorMapping> = {
      test_error: { status: 404, message: "Not found" },
    }

    const handler = createErrorHandler(
      {
        errorHandling: { kind: "mappings", config: { mappings } },
      } as ResolvedServerOptions,
      logger,
    )

    const c = mockContext({ requestId: "req-404", method: "GET", route: "/nf" })
    const error = new BaseError("Not found", { code: "test_error" })

    await handler(error, c)

    expect(logger.info).toHaveBeenCalledExactlyOnceWith(
      "Request failed",
      expect.not.objectContaining({ err: expect.anything() }),
    )

    expect(logger.error).not.toHaveBeenCalled()
  })

  describe("transformContext", () => {
    it("includes transformed context in response", async () => {
      const mappings: Record<ErrorCode, ErrorMapping> = {
        validation_error: { status: 400, message: "Invalid input" },
      }

      const transformContext = vi.fn((error: AppError) => {
        if (error.code !== "validation_error") return undefined
        return { issues: (error.context as Record<string, unknown>).issues }
      })

      const handler = createErrorHandler(
        {
          errorHandling: {
            kind: "mappings",
            config: { mappings, transformContext },
          },
        } as unknown as ResolvedServerOptions,
        logger,
      )

      const c = mockContext({ requestId: "req-123" })
      const error = new BaseError("Invalid input", {
        code: "validation_error",
        context: {
          issues: [{ path: ["filename"], message: "Required" }],
        },
      })

      const result = await handler(error, c)

      expect(transformContext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "validation_error",
          context: {
            issues: [{ path: ["filename"], message: "Required" }],
          },
        }),
      )

      expect(result.body).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "validation_error",
            status: 400,
            message: "Invalid input",
            requestId: "req-123",
            issues: [{ path: ["filename"], message: "Required" }],
          }),
        }),
      )
    })

    it("excludes context when transformer returns undefined", async () => {
      const mappings: Record<ErrorCode, ErrorMapping> = {
        test_error: { status: 400, message: "Test error" },
      }

      const transformContext = vi.fn(() => undefined)

      const handler = createErrorHandler(
        {
          errorHandling: {
            kind: "mappings",
            config: { mappings, transformContext },
          },
        } as unknown as ResolvedServerOptions,
        logger,
      )

      const c = mockContext({ requestId: "req-123" })
      const error = new BaseError("Test", {
        code: "test_error",
        context: { sensitive: "data" },
      })

      const result = await handler(error, c)

      expect(result.body).toEqual({
        error: {
          code: "test_error",
          status: 400,
          message: "Test error",
          requestId: "req-123",
        },
      })
    })

    it("does not call transformer for non-AppErrors", async () => {
      const transformContext = vi.fn()

      const handler = createErrorHandler(
        {
          errorHandling: {
            kind: "mappings",
            config: { mappings: {}, transformContext },
          },
        } as unknown as ResolvedServerOptions,
        logger,
      )

      const c = mockContext({ requestId: "req-123" })
      const error = new Error("boom")

      await handler(error, c)

      expect(transformContext).not.toHaveBeenCalled()
    })

    it("handles transformer that throws", async () => {
      const mappings: Record<ErrorCode, ErrorMapping> = {
        test_error: { status: 400, message: "Test" },
      }

      const transformContext = vi.fn(() => {
        throw new Error("transformer boom")
      })

      const handler = createErrorHandler(
        {
          errorHandling: {
            kind: "mappings",
            config: { mappings, transformContext },
          },
        } as unknown as ResolvedServerOptions,
        logger,
      )

      const c = mockContext({ requestId: "req-123" })
      const error = new BaseError("Test", { code: "test_error" })

      const result = await handler(error, c)

      expect(result.status).toBe(400)
    })

    it("works without transformContext configured", async () => {
      const mappings: Record<ErrorCode, ErrorMapping> = {
        test_error: { status: 400, message: "Test" },
      }

      const handler = createErrorHandler(
        {
          errorHandling: {
            kind: "mappings",
            config: { mappings },
          },
        } as ResolvedServerOptions,
        logger,
      )

      const c = mockContext({ requestId: "req-123" })
      const error = new BaseError("Test", {
        code: "test_error",
        context: { foo: "bar" },
      })

      const result = await handler(error, c)

      expect(result.body).toEqual({
        error: {
          code: "test_error",
          status: 400,
          message: "Test",
          requestId: "req-123",
        },
      })
    })
  })
})
