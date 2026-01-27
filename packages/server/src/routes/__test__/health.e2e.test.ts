import { buildApp } from "../../lifecycle/build-app"
import { type Application, createApp } from "../../server/server"
import { resolveOptions, type ServerOptions } from "../../server/server-options"

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe("health + ready endpoints (e2e)", () => {
  function createTestApp(
    overrides?: Partial<ServerOptions & { isReady?: () => boolean }>,
  ): Application {
    const DEFAULTS: ServerOptions = {
      port: 4663,
      errorHandling: { kind: "mappings", config: { mappings: {} } },
      requestId: {
        enabled: true,
        header: "x-request-id",
        fallbackToTraceparent: false,
      },
      requestLogging: { enabled: true, level: "info" },
      clientIp: { enabled: true, trustedProxies: 0 },
      middleware: { pre: [], post: [] },
      routes: () => {},
    }

    const options = resolveOptions({
      ...DEFAULTS,
      ...overrides,
    })

    return buildApp({
      options,
      createApp,
      createErrorHandler: () => vi.fn(),
      defaultMiddleware: [],
      isReady: overrides?.isReady ?? (() => true),
    })
  }

  describe("GET /health", () => {
    it("returns 200 when liveness is enabled", async () => {
      const app = createTestApp({ health: { enabled: true } })

      const res = await app.request("/health")
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toStrictEqual({ ok: true })
    })

    it("returns 404 when health checks disabled", async () => {
      const app = createTestApp({ health: { enabled: false } })

      const res = await app.request("/health")

      expect(res.status).toBe(404)
    })
  })

  describe("GET /ready", () => {
    it("returns 200 when server is ready and all checks pass", async () => {
      const app = createTestApp({ health: { enabled: true }, isReady: () => true })

      const res = await app.request("/ready")
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toStrictEqual({ ok: true })
    })

    it("returns 503 when server is not ready", async () => {
      const app = createTestApp({ health: { enabled: true }, isReady: () => false })

      const res = await app.request("/ready")
      const body = await res.json()

      expect(res.status).toBe(503)
      expect(body).toStrictEqual({ ok: false, reason: "starting" })
    })

    it("returns 503 when any readiness check fails", async () => {
      const app = createTestApp({
        health: {
          enabled: true,
          readinessChecks: [
            {
              name: "test.check",
              fn: async () => {
                throw new Error("check failed")
              },
            },
          ],
        },
      })

      const res = await app.request("/ready")
      const body = await res.json()

      expect(res.status).toBe(503)
      expect(body).toStrictEqual({
        ok: false,
        reason: "test.check:error",
      })
    })

    it("returns 503 when a readiness check times out", async () => {
      const app = createTestApp({
        health: {
          enabled: true,
          readinessChecks: [
            {
              name: "test.timeout",
              timeoutMs: 2,
              fn: async () => {
                await sleep(4)
                return true
              },
            },
          ],
        },
      })

      const res = await app.request("/ready")
      const body = await res.json()

      expect(res.status).toBe(503)
      expect(body).toStrictEqual({
        ok: false,
        reason: "test.timeout:timeout",
      })
    })

    it("returns 404 when health checks are disabled", async () => {
      const app = createTestApp({ health: { enabled: false } })

      const res = await app.request("/ready")

      expect(res.status).toBe(404)
    })
  })

  describe("configuration variants", () => {
    it("supports custom livenessPath and readinessPath", async () => {
      const app = createTestApp({
        health: {
          enabled: true,
          livenessPath: "/custom-health",
          readinessPath: "/custom-ready",
        },
      })

      const liveRes = await app.request("/custom-health")
      const readyRes = await app.request("/custom-ready")

      expect(liveRes.status).toBe(200)
      expect(readyRes.status).toBe(200)
    })

    it("defaults to /health and /ready when enabled", async () => {
      const app = createTestApp({ health: { enabled: true } })

      const liveRes = await app.request("/health")
      const readyRes = await app.request("/ready")

      expect(liveRes.status).toBe(200)
      expect(readyRes.status).toBe(200)
    })
  })
})
