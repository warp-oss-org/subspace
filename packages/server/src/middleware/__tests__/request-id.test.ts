import { requestIdMiddleware } from "../request-id"
import { mockContext } from "./mocks/context-mock"

describe("requestIdMiddleware", () => {
  it("uses existing requestId from context if present", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({ requestId: "ctx-123" })

    await requestIdMiddleware({
      enabled: true,
      header: "x-request-id",
      fallbackToTraceparent: true,
      generate: () => "gen-should-not-run",
    })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("requestId")).toBe("ctx-123")
    expect(c.res.headers.get("x-request-id")).toBe("ctx-123")
  })

  it("extracts requestId from configured header when present", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({ requestHeaders: { "x-request-id": "hdr-123" } })

    await requestIdMiddleware({
      enabled: true,
      header: "x-request-id",
      fallbackToTraceparent: false,
      generate: () => "gen-should-not-run",
    })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("requestId")).toBe("hdr-123")
    expect(c.res.headers.get("x-request-id")).toBe("hdr-123")
  })

  it("falls back to traceparent when enabled and header missing", async () => {
    const next = vi.fn(async () => {})

    const traceId = "4bf92f3577b34da6a3ce929d0e0e4736"
    const c = mockContext({
      requestHeaders: {
        traceparent: `00-${traceId}-00f067aa0ba902b7-01`,
      },
    })

    await requestIdMiddleware({
      enabled: true,
      header: "x-request-id",
      fallbackToTraceparent: true,
      generate: () => "gen-should-not-run",
    })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("requestId")).toBe(traceId)
    expect(c.res.headers.get("x-request-id")).toBe(traceId)
  })

  it("generates requestId when missing", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await requestIdMiddleware({
      enabled: true,
      header: "x-request-id",
      fallbackToTraceparent: false,
      generate: () => "gen-123",
    })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("requestId")).toBe("gen-123")
    expect(c.res.headers.get("x-request-id")).toBe("gen-123")
  })

  it("attaches requestId to context for downstream middleware/routes", async () => {
    const c = mockContext({ requestHeaders: { "x-request-id": "downstream-123" } })

    const next = vi.fn(async () => {
      expect(c.get("requestId")).toBe("downstream-123")
    })

    await requestIdMiddleware({
      enabled: true,
      header: "x-request-id",
      fallbackToTraceparent: false,
      generate: () => "gen-should-not-run",
    })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("requestId")).toBe("downstream-123")
    expect(c.res.headers.get("x-request-id")).toBe("downstream-123")
  })

  it("sets requestId response header after next()", async () => {
    const c = mockContext({ requestHeaders: { "x-request-id": "after-123" } })

    const next = vi.fn(async () => {
      expect(c.res.headers.get("x-request-id")).toBeUndefined()
    })

    await requestIdMiddleware({
      enabled: true,
      header: "x-request-id",
      fallbackToTraceparent: false,
      generate: () => "gen-should-not-run",
    })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.get("x-request-id")).toBe("after-123")
  })

  it("does not overwrite response header if already set", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      requestHeaders: { "x-request-id": "req-123" },
      responseHeaders: { "x-request-id": "already-set" },
    })

    await requestIdMiddleware({
      enabled: true,
      header: "x-request-id",
      fallbackToTraceparent: false,
      generate: () => "gen-should-not-run",
    })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("requestId")).toBe("req-123")
    expect(c.res.headers.get("x-request-id")).toBe("already-set")
  })

  it("ignores existing requestId on context when it is not a non-empty string", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({})

    c.set("requestId", 123 as any)

    await requestIdMiddleware({
      enabled: true,
      header: "x-request-id",
      fallbackToTraceparent: false,
      generate: () => "gen-123",
    })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("requestId")).toBe("gen-123")
    expect(c.res.headers.get("x-request-id")).toBe("gen-123")
  })

  it("reads requestId header when config.header is provided with different casing", async () => {
    const next = vi.fn(async () => {})

    const c = mockContext({ requestHeaders: { "x-request-id": "hdr-123" } })

    await requestIdMiddleware({
      enabled: true,
      header: "X-Request-Id",
      fallbackToTraceparent: false,
      generate: () => "gen-should-not-run",
    })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("requestId")).toBe("hdr-123")

    expect(c.res.headers.get("x-request-id")).toBe("hdr-123")
  })

  it("ignores configured header when it is empty/whitespace", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({ requestHeaders: { "x-request-id": "   " } })

    await requestIdMiddleware({
      enabled: true,
      header: "x-request-id",
      fallbackToTraceparent: false,
      generate: () => "gen-123",
    })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("requestId")).toBe("gen-123")
    expect(c.res.headers.get("x-request-id")).toBe("gen-123")
  })

  it("does not use traceparent when fallbackToTraceparent is false", async () => {
    const next = vi.fn(async () => {})

    const traceId = "4bf92f3577b34da6a3ce929d0e0e4736"
    const c = mockContext({
      requestHeaders: {
        traceparent: `00-${traceId}-00f067aa0ba902b7-01`,
      },
    })

    await requestIdMiddleware({
      enabled: true,
      header: "x-request-id",
      fallbackToTraceparent: false,
      generate: () => "gen-123",
    })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("requestId")).toBe("gen-123")
    expect(c.res.headers.get("x-request-id")).toBe("gen-123")
  })

  it("falls back to generate when traceparent is invalid (too few parts)", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({ requestHeaders: { traceparent: "00-deadbeef" } })

    await requestIdMiddleware({
      enabled: true,
      header: "x-request-id",
      fallbackToTraceparent: true,
      generate: () => "gen-123",
    })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("requestId")).toBe("gen-123")
    expect(c.res.headers.get("x-request-id")).toBe("gen-123")
  })

  it("falls back to generate when traceparent traceId is not 32 hex chars", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      requestHeaders: {
        traceparent: "00-not32hex-00f067aa0ba902b7-01",
      },
    })

    await requestIdMiddleware({
      enabled: true,
      header: "x-request-id",
      fallbackToTraceparent: true,
      generate: () => "gen-123",
    })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("requestId")).toBe("gen-123")
    expect(c.res.headers.get("x-request-id")).toBe("gen-123")
  })

  it("falls back to generate when traceparent traceId is all zeros", async () => {
    const next = vi.fn(async () => {})
    const zeros = "0".repeat(32)
    const c = mockContext({
      requestHeaders: {
        traceparent: `00-${zeros}-00f067aa0ba902b7-01`,
      },
    })

    await requestIdMiddleware({
      enabled: true,
      header: "x-request-id",
      fallbackToTraceparent: true,
      generate: () => "gen-123",
    })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("requestId")).toBe("gen-123")
    expect(c.res.headers.get("x-request-id")).toBe("gen-123")
  })

  it("does not overwrite response header if it is set during next()", async () => {
    const c = mockContext({ requestHeaders: { "x-request-id": "req-123" } })

    const next = vi.fn(async () => {
      c.res.headers.set("x-request-id", "set-in-handler")
    })

    await requestIdMiddleware({
      enabled: true,
      header: "x-request-id",
      fallbackToTraceparent: false,
      generate: () => "gen-should-not-run",
    })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("requestId")).toBe("req-123")
    expect(c.res.headers.get("x-request-id")).toBe("set-in-handler")
  })
})
