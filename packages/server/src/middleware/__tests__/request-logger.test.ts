import { requestLoggerMiddleware } from "../request-logger"
import { mockContext } from "./mocks/context-mock"

describe("requestLoggerMiddleware", () => {
  it("attaches child logger to context when none exists", async () => {
    const childLogger = { info: vi.fn(), child: vi.fn() } as any
    const baseLogger = { child: vi.fn(() => childLogger) } as any

    const c = mockContext()
    const next = vi.fn(async () => {})

    await requestLoggerMiddleware(baseLogger)(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(baseLogger.child).toHaveBeenCalledOnce()
    expect(c.get("logger")).toBe(childLogger)
  })

  it("includes requestId binding when requestId exists on context", async () => {
    const childLogger = { info: vi.fn(), child: vi.fn() } as any
    const baseLogger = { child: vi.fn(() => childLogger) } as any

    const c = mockContext({ requestId: "req-123" })
    const next = vi.fn(async () => {})

    await requestLoggerMiddleware(baseLogger)(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(baseLogger.child).toHaveBeenCalledWith({ requestId: "req-123" })
    expect(c.get("logger")).toBe(childLogger)
  })

  it("does not include requestId binding when requestId is missing/empty", async () => {
    const childLogger = { info: vi.fn(), child: vi.fn() } as any
    const baseLogger = { child: vi.fn(() => childLogger) } as any

    const cases: Array<string | undefined> = [undefined, "", "   "]

    for (const requestId of cases) {
      baseLogger.child.mockClear()

      const c = mockContext(requestId === undefined ? {} : { requestId })
      const next = vi.fn(async () => {})

      await requestLoggerMiddleware(baseLogger)(c, next)

      expect(next).toHaveBeenCalledOnce()
      expect(baseLogger.child).toHaveBeenCalledWith({})
      expect(c.get("logger")).toBe(childLogger)
    }
  })

  it("does not overwrite existing logger on context", async () => {
    const existingLogger = { warn: vi.fn(), child: vi.fn() } as any
    const baseLogger = { child: vi.fn(() => ({}) as any) } as any

    const c = mockContext({ logger: existingLogger })
    const next = vi.fn(async () => {})

    await requestLoggerMiddleware(baseLogger)(c, next)

    expect(next).toHaveBeenCalledOnce()
    expect(baseLogger.child).not.toHaveBeenCalled()
    expect(c.get("logger")).toBe(existingLogger)
  })
})
