import { hstsMiddleware } from "../hsts"
import { mockContext } from "./mocks/context-mock"

describe("hstsMiddleware", () => {
  it("sets Strict-Transport-Security header with defaults", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      requestHeaders: {
        "x-forwarded-proto": "https",
      },
    })

    await hstsMiddleware()(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    )
  })

  it("includes includeSubDomains by default", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      requestHeaders: {
        "x-forwarded-proto": "https",
      },
    })

    await hstsMiddleware()(c, next)

    const value = c.res.headers.get("Strict-Transport-Security")
    expect(value).toContain("includeSubDomains")
  })

  it("omits includeSubDomains when disabled", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      requestHeaders: {
        "x-forwarded-proto": "https",
      },
    })

    await hstsMiddleware({ includeSubDomains: false })(c, next)

    const value = c.res.headers.get("Strict-Transport-Security")
    expect(value).toBe("max-age=31536000")
  })

  it("adds preload when enabled", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      requestHeaders: {
        "x-forwarded-proto": "https",
      },
    })

    await hstsMiddleware({ preload: true })(c, next)

    const value = c.res.headers.get("Strict-Transport-Security")
    expect(value).toContain("preload")
  })

  it("does not overwrite Strict-Transport-Security if already set", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      requestHeaders: {
        "x-forwarded-proto": "https",
      },
      responseHeaders: {
        "Strict-Transport-Security": "max-age=123",
      },
    })

    await hstsMiddleware()(c, next)

    expect(c.res.headers.get("Strict-Transport-Security")).toBe("max-age=123")
  })

  it("does not set Strict-Transport-Security when request is not HTTPS", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      requestHeaders: {
        "x-forwarded-proto": "http",
      },
    })

    await hstsMiddleware()(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.get("Strict-Transport-Security")).toBeUndefined()
  })

  it("does not set Strict-Transport-Security when x-forwarded-proto is missing (defaults to http)", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      url: "http://example.test/",
    })

    await hstsMiddleware()(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.get("Strict-Transport-Security")).toBeUndefined()
  })

  it("does not set Strict-Transport-Security when x-forwarded-proto has multiple values and the first is http", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      requestHeaders: {
        "x-forwarded-proto": "http, https",
      },
    })

    await hstsMiddleware()(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.get("Strict-Transport-Security")).toBeUndefined()
  })

  it("treats x-forwarded-proto with whitespace/casing as HTTPS", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      requestHeaders: {
        "x-forwarded-proto": "  HTTPS  ",
      },
    })

    await hstsMiddleware()(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    )
  })

  it("treats x-forwarded-proto 'https:' as HTTPS", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      requestHeaders: {
        "x-forwarded-proto": "https:",
      },
    })

    await hstsMiddleware()(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    )
  })

  it("does not set Strict-Transport-Security for unknown protocols", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      requestHeaders: {
        "x-forwarded-proto": "ftp",
      },
    })

    await hstsMiddleware()(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.get("Strict-Transport-Security")).toBeUndefined()
  })

  it("treats x-forwarded-proto with multiple values as HTTPS when the first is https", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      requestHeaders: {
        "x-forwarded-proto": "https, http",
      },
    })

    await hstsMiddleware()(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    )
  })
})
