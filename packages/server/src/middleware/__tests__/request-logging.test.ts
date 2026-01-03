import type { Logger } from "@subspace/logger"
import { mock } from "vitest-mock-extended"
import type { Mock } from "../../tests/mock"
import { requestLoggingMiddleware } from "../request-logging"
import { mockContext } from "./mocks/context-mock"

describe("requestLoggingMiddleware", () => {
  let baseLogger: Mock<Logger>

  beforeEach(() => {
    baseLogger = mock<Logger>()
  })

  it("skips logging for ignored paths", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({ path: "/health" })

    await requestLoggingMiddleware(
      { enabled: true, level: "info", ignorePaths: ["/health"] },
      baseLogger,
    )(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect((baseLogger as any).info).not.toHaveBeenCalled()
    expect((baseLogger as any).error).not.toHaveBeenCalled()
  })

  it("skips logging for ignored path prefixes", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({ path: "/health/foo" })

    await requestLoggingMiddleware(
      { enabled: true, level: "info", ignorePaths: ["/health"] },
      baseLogger,
    )(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect((baseLogger as any).info).not.toHaveBeenCalled()
    expect((baseLogger as any).error).not.toHaveBeenCalled()
  })

  it("logs request completion with method/path/route/status/duration", async () => {
    const next = vi.fn(async () => {})

    const c = mockContext({
      method: "GET",
      path: "/test",
      status: 204,
      requestId: "req-1",
      route: "/test/:id",
    })

    const nowSpy = vi.spyOn(globalThis.performance, "now")
    nowSpy.mockImplementationOnce(() => 1000).mockImplementationOnce(() => 1025.4321)

    await requestLoggingMiddleware(
      { enabled: true, level: "info", ignorePaths: [] },
      baseLogger,
    )(c, next)

    expect(next).toHaveBeenCalledOnce()

    expect(baseLogger.info).toHaveBeenCalledWith(
      "Request completed",
      expect.objectContaining({
        requestId: "req-1",
        method: "GET",
        path: "/test",
        route: "/test/:id",
        status: 204,
        error: false,
        durationMs: 25,
        op: "GET /test/:id",
      }),
    )

    nowSpy.mockRestore()
  })

  it("falls back route to path when route is not available", async () => {
    const next = vi.fn(async () => {})

    const c = mockContext({
      method: "GET",
      path: "/test",
      status: 200,
      requestId: "req-1",
    })

    await requestLoggingMiddleware(
      { enabled: true, level: "info", ignorePaths: [] },
      baseLogger,
    )(c, next)

    expect(next).toHaveBeenCalledOnce()

    expect((baseLogger as any).info).toHaveBeenCalledWith(
      "Request completed",
      expect.objectContaining({
        path: "/test",
        route: "/test",
      }),
    )
  })

  it("includes requestId when present, otherwise uses 'unknown'", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({ method: "GET", path: "/x", status: 200 })

    await requestLoggingMiddleware(
      { enabled: true, level: "info", ignorePaths: [] },
      baseLogger,
    )(c, next)

    expect((baseLogger as any).info).toHaveBeenCalledWith(
      "Request completed",
      expect.objectContaining({ requestId: "unknown" }),
    )
  })

  it("includes clientIp when present on context", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({ method: "GET", path: "/x", status: 200, requestId: "r1" })

    c.set("clientIp", "203.0.113.10")

    await requestLoggingMiddleware(
      { enabled: true, level: "info", ignorePaths: [] },
      baseLogger,
    )(c, next)

    expect((baseLogger as any).info).toHaveBeenCalledWith(
      "Request completed",
      expect.objectContaining({ clientIp: "203.0.113.10" }),
    )
  })

  it("includes remoteIp when present on context", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({ method: "GET", path: "/x", status: 200, requestId: "r1" })

    c.set("remoteIp", "203.0.113.10")

    await requestLoggingMiddleware(
      { enabled: true, level: "info", ignorePaths: [] },
      baseLogger,
    )(c, next)

    expect((baseLogger as any).info).toHaveBeenCalledWith(
      "Request completed",
      expect.objectContaining({ remoteIp: "203.0.113.10" }),
    )
  })

  it("omits clientIp when not present on context", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({ method: "GET", path: "/x", status: 200, requestId: "r1" })

    await requestLoggingMiddleware(
      { enabled: true, level: "info", ignorePaths: [] },
      baseLogger,
    )(c, next)

    const meta = (baseLogger as any).info.mock.calls[0][1]
    expect(meta).not.toHaveProperty("clientIp")
  })

  it("includes user-agent when present on request headers", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      method: "GET",
      path: "/x",
      status: 200,
      requestId: "r1",
      requestHeaders: { "user-agent": "Mozilla/5.0 test" },
    })

    await requestLoggingMiddleware(
      { enabled: true, level: "info", ignorePaths: [] },
      baseLogger,
    )(c, next)

    expect((baseLogger as any).info).toHaveBeenCalledWith(
      "Request completed",
      expect.objectContaining({ userAgent: "Mozilla/5.0 test" }),
    )
  })

  it("omits userAgent when not present", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      method: "GET",
      path: "/x",
      status: 200,
      requestId: "r1",
    })

    await requestLoggingMiddleware(
      { enabled: true, level: "info", ignorePaths: [] },
      baseLogger,
    )(c, next)

    const meta = (baseLogger as any).info.mock.calls[0][1]
    expect(meta).not.toHaveProperty("userAgent")
  })

  it("uses context logger when present, otherwise uses base logger", async () => {
    const baseLogger = mock<Logger>()
    const ctxLogger = mock<Logger>()

    const next = vi.fn(async () => {})
    const c = mockContext({ method: "GET", path: "/x", status: 200, requestId: "r1" })

    c.set("logger", ctxLogger)

    await requestLoggingMiddleware(
      { enabled: true, level: "info", ignorePaths: [] },
      baseLogger,
    )(c, next)

    expect((ctxLogger as any).info).toHaveBeenCalledOnce()
    expect((baseLogger as any).info).not.toHaveBeenCalled()
  })

  it("uses context logger for 5xx responses", async () => {
    const baseLogger = mock<Logger>()
    const ctxLogger = mock<Logger>()

    const next = vi.fn(async () => {})
    const c = mockContext({ method: "GET", path: "/x", status: 503, requestId: "r1" })

    c.set("logger", ctxLogger)

    await requestLoggingMiddleware(
      { enabled: true, level: "info", ignorePaths: [] },
      baseLogger,
    )(c, next)

    expect((ctxLogger as any).error).toHaveBeenCalledOnce()
    expect((baseLogger as any).error).not.toHaveBeenCalled()
    expect((ctxLogger as any).info).not.toHaveBeenCalled()
  })

  it("logs 5xx responses at error regardless of configured level", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({ method: "GET", path: "/x", status: 503, requestId: "r1" })

    await requestLoggingMiddleware(
      { enabled: true, level: "debug", ignorePaths: [] },
      baseLogger,
    )(c, next)

    expect((baseLogger as any).error).toHaveBeenCalledOnce()
    expect((baseLogger as any).debug).not.toHaveBeenCalled()
  })

  it("logs non-5xx at configured level", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({ method: "GET", path: "/x", status: 404, requestId: "r1" })

    await requestLoggingMiddleware(
      { enabled: true, level: "warn", ignorePaths: [] },
      baseLogger,
    )(c, next)

    expect((baseLogger as any).warn).toHaveBeenCalledOnce()
    expect((baseLogger as any).error).not.toHaveBeenCalled()
  })

  it("still logs when downstream throws (finally path)", async () => {
    const err = new Error("boom")
    const next = vi.fn(async () => {
      throw err
    })
    const c = mockContext({ method: "GET", path: "/x", status: 500, requestId: "r1" })

    await expect(
      requestLoggingMiddleware(
        { enabled: true, level: "info", ignorePaths: [] },
        baseLogger,
      )(c, next),
    ).rejects.toThrow("boom")

    expect((baseLogger as any).error).toHaveBeenCalledOnce()
  })
})
