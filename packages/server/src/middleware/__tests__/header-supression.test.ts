import { headerSuppressionMiddleware } from "../header-suppression"
import { mockContext } from "./mocks/context-mock"

describe("headerSuppressionMiddleware", () => {
  it("removes X-Powered-By header", async () => {
    const next = vi.fn(async () => {})

    const c = mockContext({
      responseHeaders: {
        "X-Powered-By": "test",
      },
    })

    await headerSuppressionMiddleware()(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.has("X-Powered-By")).toBe(false)
  })

  it("removes Server header", async () => {
    const next = vi.fn(async () => {})

    const c = mockContext({
      responseHeaders: {
        Server: "test",
      },
    })

    await headerSuppressionMiddleware()(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.has("Server")).toBe(false)
  })

  it("does not throw if headers are missing", async () => {
    const next = vi.fn(async () => {})

    const c = mockContext({
      responseHeaders: {},
    })

    await expect(headerSuppressionMiddleware()(c, next)).resolves.toBeUndefined()

    expect(next).toHaveBeenCalledOnce()
    expect(c.res.headers.has("X-Powered-By")).toBe(false)
    expect(c.res.headers.has("Server")).toBe(false)
  })
})
