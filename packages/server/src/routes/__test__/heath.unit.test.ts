import type { Application } from "../../create-server"
import type { ReadinessCheck, ResolvedHealthConfig } from "../../server-options"
import { registerHealthRoutes } from "../health"

type GetHandler = (c: any) => any | Promise<any>

function createMockApp() {
  const routes = new Map<string, GetHandler>()

  const app = {
    get: vi.fn((path: string, handler: GetHandler) => {
      routes.set(path, handler)
      return app
    }),
  }

  return { app: app as unknown as Application, routes, getMock: app.get }
}

function createMockContext() {
  return {
    json: vi.fn((body: unknown, init?: any) => ({ body, init })),
  }
}

describe("registerHealthRoutes (unit)", () => {
  it("does nothing when disabled", () => {
    const { app, getMock } = createMockApp()

    const config = { enabled: false } as unknown as ResolvedHealthConfig

    registerHealthRoutes(app, config, () => true)

    expect(getMock).not.toHaveBeenCalled()
  })

  it("registers liveness + readiness routes when enabled", () => {
    const { app, getMock } = createMockApp()

    const config: ResolvedHealthConfig = {
      enabled: true,
      livenessPath: "/health",
      readinessPath: "/ready",
      readinessChecks: [],
      checkTimeoutMs: 5_000,
    }

    registerHealthRoutes(app, config, () => true)

    expect(getMock).toHaveBeenCalledTimes(2)
    expect(getMock).toHaveBeenNthCalledWith(1, "/health", expect.any(Function))
    expect(getMock).toHaveBeenNthCalledWith(2, "/ready", expect.any(Function))
  })

  it("uses configured livenessPath/readinessPath", () => {
    const { app, getMock } = createMockApp()

    const config: ResolvedHealthConfig = {
      enabled: true,
      livenessPath: "/live",
      readinessPath: "/readyz",
      readinessChecks: [],
      checkTimeoutMs: 5_000,
    }

    registerHealthRoutes(app, config, () => true)

    expect(getMock).toHaveBeenCalledTimes(2)
    expect(getMock).toHaveBeenNthCalledWith(1, "/live", expect.any(Function))
    expect(getMock).toHaveBeenNthCalledWith(2, "/readyz", expect.any(Function))
  })

  it("liveness handler returns ok:true and sets no-cache headers", async () => {
    const { app, routes } = createMockApp()

    const config: ResolvedHealthConfig = {
      enabled: true,
      livenessPath: "/health",
      readinessPath: "/ready",
      readinessChecks: [],
      checkTimeoutMs: 5_000,
    }

    registerHealthRoutes(app, config, () => true)

    const handler = routes.get("/health")
    expect(handler).toBeTypeOf("function")

    const c = createMockContext()
    await handler?.(c)

    expect(c.json).toHaveBeenCalledExactlyOnceWith(
      { ok: true },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    )
  })

  it("readiness handler checks isReady() and returns 503 when not ready (does not run checks)", async () => {
    const { app, routes } = createMockApp()

    const checkFn = vi.fn(async () => true)
    const checks: ReadinessCheck[] = [{ name: "test.check", fn: checkFn }]

    const isReady = vi.fn(() => false)

    const config: ResolvedHealthConfig = {
      enabled: true,
      livenessPath: "/health",
      readinessPath: "/ready",
      readinessChecks: checks,
      checkTimeoutMs: 5_000,
    }

    registerHealthRoutes(app, config, isReady)

    const handler = routes.get("/ready")
    expect(handler).toBeTypeOf("function")

    const c = createMockContext()
    await handler?.(c)

    expect(isReady).toHaveBeenCalledTimes(1)
    expect(checkFn).not.toHaveBeenCalled()

    expect(c.json).toHaveBeenCalledExactlyOnceWith(
      { ok: false, reason: "starting" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      },
    )
  })

  it("readiness handler returns ok:true when ready and no checks", async () => {
    const { app, routes } = createMockApp()

    const config: ResolvedHealthConfig = {
      enabled: true,
      livenessPath: "/health",
      readinessPath: "/ready",
      readinessChecks: [],
      checkTimeoutMs: 5_000,
    }

    registerHealthRoutes(app, config, () => true)

    const handler = routes.get("/ready")
    expect(handler).toBeTypeOf("function")

    const c = createMockContext()
    await handler?.(c)

    expect(c.json).toHaveBeenCalledExactlyOnceWith(
      { ok: true },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    )
  })
})
