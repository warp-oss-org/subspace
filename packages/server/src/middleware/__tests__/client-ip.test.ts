import { clientIpMiddleware, ipFromXForwardedFor } from "../client-ip"
import { mockContext } from "./mocks/context-mock"

describe("clientIpMiddleware", () => {
  it("sets remoteIp when socket remoteAddress is present", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({ remoteIp: "203.0.113.10" })

    await clientIpMiddleware()(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("remoteIp")).toBe("203.0.113.10")
    expect(c.get("clientIp")).toBe("203.0.113.10")
  })

  it("normalizes IPv4-mapped IPv6 remoteAddress (::ffff:1.2.3.4)", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({ socketRemoteAddress: "::ffff:1.2.3.4" })

    await clientIpMiddleware()(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("remoteIp")).toBe("1.2.3.4")
    expect(c.get("clientIp")).toBe("1.2.3.4")
  })

  it("when trustedProxies > 0, sets clientIp from X-Forwarded-For", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      remoteIp: "10.0.0.5",
      requestHeaders: {
        "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3",
      },
    })

    await clientIpMiddleware(1)(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("remoteIp")).toBe("10.0.0.5")
    expect(c.get("clientIp")).toBe("2.2.2.2")
  })

  it("when trustedProxies > 0 and XFF missing/invalid, falls back clientIp to remoteIp", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      remoteIp: "10.0.0.5",
      requestHeaders: {
        "x-forwarded-for": "   ",
      },
    })

    await clientIpMiddleware(1)(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("remoteIp")).toBe("10.0.0.5")
    expect(c.get("clientIp")).toBe("10.0.0.5")
  })

  it("does not overwrite existing clientIp/remoteIp on context", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      clientIp: "198.51.100.20",
      remoteIp: "10.0.0.9",
      requestHeaders: {
        "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3",
      },
    })

    await clientIpMiddleware(1)(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("remoteIp")).toBe("10.0.0.9")
    expect(c.get("clientIp")).toBe("198.51.100.20")
  })

  it("when XFF chain shorter than trustedProxies, does not set clientIp from XFF", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      remoteIp: "10.0.0.5",
      requestHeaders: {
        "x-forwarded-for": "1.1.1.1, 2.2.2.2",
      },
    })

    await clientIpMiddleware(5)(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("remoteIp")).toBe("10.0.0.5")
    expect(c.get("clientIp")).toBe("10.0.0.5")
  })

  it("does not use X-Forwarded-For when trustedProxies is 0", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      remoteIp: "10.0.0.5",
      requestHeaders: {
        "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3",
      },
    })

    await clientIpMiddleware(0)(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("remoteIp")).toBe("10.0.0.5")
    expect(c.get("clientIp")).toBe("10.0.0.5")
  })

  it("does not use X-Forwarded-For when trustedProxies is negative", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      remoteIp: "10.0.0.5",
      requestHeaders: {
        "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3",
      },
    })

    await clientIpMiddleware(-3)(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("remoteIp")).toBe("10.0.0.5")
    expect(c.get("clientIp")).toBe("10.0.0.5")
  })

  it("with trustedProxies=2, resolves the left-most client IP from XFF", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({
      remoteIp: "10.0.0.5",
      requestHeaders: {
        "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3",
      },
    })

    await clientIpMiddleware(2)(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("remoteIp")).toBe("10.0.0.5")
    expect(c.get("clientIp")).toBe("1.1.1.1")
  })

  it("when remoteAddress is missing/empty, does not set remoteIp/clientIp", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({ remoteIp: "" })

    await clientIpMiddleware()(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("remoteIp")).toBeUndefined()
    expect(c.get("clientIp")).toBeUndefined()
  })

  it("when only remoteIp exists on context, it does not overwrite it but ensures clientIp is present", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({ remoteIp: "203.0.113.10" })

    c.set("remoteIp", "203.0.113.10")

    await clientIpMiddleware()(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("remoteIp")).toBe("203.0.113.10")
    expect(c.get("clientIp")).toBe("203.0.113.10")
  })

  it("when only clientIp exists on context, it does not overwrite it but can still set remoteIp", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({ remoteIp: "10.0.0.9" })

    c.set("clientIp", "198.51.100.20")

    await clientIpMiddleware()(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("clientIp")).toBe("198.51.100.20")
    expect(c.get("remoteIp")).toBe("10.0.0.9")
  })

  it("uses socket remoteAddress as clientIp when trustedProxies is 0", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({ socketRemoteAddress: "203.0.113.10" })

    await clientIpMiddleware(0)(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("remoteIp")).toBe("203.0.113.10")
    expect(c.get("clientIp")).toBe("203.0.113.10")
  })

  it("treats whitespace-only socket remoteAddress as missing", async () => {
    const next = vi.fn(async () => {})
    const c = mockContext({ socketRemoteAddress: "   " })

    await clientIpMiddleware()(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.get("remoteIp")).toBeUndefined()
    expect(c.get("clientIp")).toBeUndefined()
  })
})

describe("ipFromXForwardedFor", () => {
  it("returns undefined when trustedProxies is 0 or less", () => {
    expect(ipFromXForwardedFor("1.1.1.1, 2.2.2.2", 0)).toBeUndefined()
    expect(ipFromXForwardedFor("1.1.1.1, 2.2.2.2", -1)).toBeUndefined()
  })

  it("returns undefined when X-Forwarded-For contains no usable entries", () => {
    expect(ipFromXForwardedFor(" ,  ,   ", 1)).toBeUndefined()
  })
})
