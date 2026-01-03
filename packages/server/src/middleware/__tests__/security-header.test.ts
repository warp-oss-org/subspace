import { securityHeadersMiddleware } from "../security-headers"
import { mockContext } from "./mocks/context-mock"

describe("securityHeadersMiddleware", () => {
  it("sets default OWASP-recommended headers", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await securityHeadersMiddleware()(c, next)

    expect(next).toHaveBeenCalledOnce()

    expect(c.res.headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect(c.res.headers.get("X-Frame-Options")).toBe("DENY")
    expect(c.res.headers.get("X-XSS-Protection")).toBe("0")
    expect(c.res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin")
    expect(c.res.headers.get("X-Permitted-Cross-Domain-Policies")).toBe("none")

    expect(c.res.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin")
    expect(c.res.headers.get("Cross-Origin-Embedder-Policy")).toBe("require-corp")
    expect(c.res.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin")

    expect(c.res.headers.get("Cache-Control")).toBe("no-store, max-age=0")
    expect(c.res.headers.get("X-DNS-Prefetch-Control")).toBe("off")

    expect(c.res.headers.get("Content-Security-Policy")).toBe(
      [
        "default-src 'self'",
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests",
      ].join("; "),
    )

    const pp = c.res.headers.get("Permissions-Policy")
    expect(pp).toContain("geolocation=()")
    expect(pp).toContain("camera=()")
    expect(pp).toContain("; ")
  })

  it("does not overwrite headers that are already set", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      responseHeaders: {
        "X-Content-Type-Options": "custom",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "no-referrer",
        "Cross-Origin-Opener-Policy": "unsafe-none",
        "Content-Security-Policy": "default-src 'none'",
      },
    })

    await securityHeadersMiddleware()(c, next)

    expect(next).toHaveBeenCalledOnce()

    expect(c.res.headers.get("X-Content-Type-Options")).toBe("custom")
    expect(c.res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN")
    expect(c.res.headers.get("Referrer-Policy")).toBe("no-referrer")
    expect(c.res.headers.get("Cross-Origin-Opener-Policy")).toBe("unsafe-none")
    expect(c.res.headers.get("Content-Security-Policy")).toBe("default-src 'none'")
  })

  it("allows disabling specific headers via config", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await securityHeadersMiddleware({
      contentTypeOptions: false,
      frameOptions: false,
      xssProtection: false,
      referrerPolicy: false,
      permittedCrossDomainPolicies: false,
      crossOriginOpenerPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: false,
      cacheControl: false,
      dnsPrefetchControl: false,
      contentSecurityPolicy: false,
      permissionsPolicy: false,
    })(c, next)

    expect(next).toHaveBeenCalledOnce()

    expect(c.res.headers.get("X-Content-Type-Options")).toBeUndefined()
    expect(c.res.headers.get("X-Frame-Options")).toBeUndefined()
    expect(c.res.headers.get("X-XSS-Protection")).toBeUndefined()
    expect(c.res.headers.get("Referrer-Policy")).toBeUndefined()
    expect(c.res.headers.get("X-Permitted-Cross-Domain-Policies")).toBeUndefined()

    expect(c.res.headers.get("Cross-Origin-Opener-Policy")).toBeUndefined()
    expect(c.res.headers.get("Cross-Origin-Embedder-Policy")).toBeUndefined()
    expect(c.res.headers.get("Cross-Origin-Resource-Policy")).toBeUndefined()

    expect(c.res.headers.get("Cache-Control")).toBeUndefined()
    expect(c.res.headers.get("X-DNS-Prefetch-Control")).toBeUndefined()

    expect(c.res.headers.get("Content-Security-Policy")).toBeUndefined()
    expect(c.res.headers.get("Permissions-Policy")).toBeUndefined()
  })

  it("frameOptions: true resolves to DENY", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await securityHeadersMiddleware({ frameOptions: true })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.get("X-Frame-Options")).toBe("DENY")
  })

  it("frameOptions: explicit value passes through", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await securityHeadersMiddleware({ frameOptions: "SAMEORIGIN" })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN")
  })

  it("referrerPolicy: true resolves to no-referrer", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await securityHeadersMiddleware({ referrerPolicy: true })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.get("Referrer-Policy")).toBe("no-referrer")
  })

  it("referrerPolicy: explicit value passes through", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await securityHeadersMiddleware({ referrerPolicy: "origin" })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.get("Referrer-Policy")).toBe("origin")
  })

  it("dnsPrefetchControl: true resolves to off", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await securityHeadersMiddleware({ dnsPrefetchControl: true })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.get("X-DNS-Prefetch-Control")).toBe("off")
  })

  it("dnsPrefetchControl: explicit value passes through", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await securityHeadersMiddleware({ dnsPrefetchControl: "on" })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.get("X-DNS-Prefetch-Control")).toBe("on")
  })

  it("cacheControl: empty/whitespace string falls back to default", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await securityHeadersMiddleware({ cacheControl: "   " })(c, next)

    expect(c.res.headers.get("Cache-Control")).toBe("no-store, max-age=0")
  })

  it("cacheControl: custom string is used", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await securityHeadersMiddleware({ cacheControl: "public, max-age=60" })(c, next)

    expect(c.res.headers.get("Cache-Control")).toBe("public, max-age=60")
  })

  it("contentSecurityPolicy: true uses default", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await securityHeadersMiddleware({ contentSecurityPolicy: true })(c, next)

    expect(c.res.headers.get("Content-Security-Policy")).toBeDefined()
  })

  it("contentSecurityPolicy: array joins with '; '", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await securityHeadersMiddleware({
      contentSecurityPolicy: ["default-src 'none'", "frame-ancestors 'none'"],
    })(c, next)

    expect(c.res.headers.get("Content-Security-Policy")).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    )
  })

  it("contentSecurityPolicy: empty array results in no header", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await securityHeadersMiddleware({ contentSecurityPolicy: [] })(c, next)

    expect(c.res.headers.get("Content-Security-Policy")).toBeUndefined()
  })

  it("permissionsPolicy: array joins with '; '", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await securityHeadersMiddleware({
      permissionsPolicy: ["geolocation=()", "camera=()"],
    })(c, next)

    expect(c.res.headers.get("Permissions-Policy")).toBe("geolocation=(); camera=()")
  })

  it("permissionsPolicy: empty array results in no header", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await securityHeadersMiddleware({ permissionsPolicy: [] })(c, next)

    expect(c.res.headers.get("Permissions-Policy")).toBeUndefined()
  })

  it("falls back frameOptions to DENY when config provides undefined", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await securityHeadersMiddleware({ frameOptions: undefined } as any)(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.get("X-Frame-Options")).toBe("DENY")
  })

  it("falls back referrerPolicy to no-referrer when config provides undefined", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await securityHeadersMiddleware({ referrerPolicy: undefined } as any)(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.get("Referrer-Policy")).toBe("no-referrer")
  })

  it("falls back dnsPrefetchControl to default when config provides undefined", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await securityHeadersMiddleware({ dnsPrefetchControl: undefined } as any)(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.get("X-DNS-Prefetch-Control")).toBe("off")
  })

  it("when cacheControl is true, uses the default Cache-Control value", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await securityHeadersMiddleware({ cacheControl: true })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.get("Cache-Control")).toBe("no-store, max-age=0")
  })

  it("when cacheControl is a non-empty string, uses the trimmed value", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await securityHeadersMiddleware({ cacheControl: " public, max-age=60 " })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.get("Cache-Control")).toBe("public, max-age=60")
  })

  it("when cacheControl is whitespace, falls back to the default value", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext()

    await securityHeadersMiddleware({ cacheControl: "   " })(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.get("Cache-Control")).toBe("no-store, max-age=0")
  })
})
