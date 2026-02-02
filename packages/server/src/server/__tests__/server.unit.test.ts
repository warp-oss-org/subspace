import { FakeClock } from "@subspace/clock"
import type { Logger } from "@subspace/logger"
import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { mock } from "vitest-mock-extended"
import type { ServerHandle } from "../../lifecycle/create-stopper"
import type { StopResult } from "../../lifecycle/shutdown"
import type { Context, ResolvedServerOptions, ServerDependencies } from ".."
import {
  type Application,
  type Middleware,
  Server,
  type ServerCollaborators,
  type ServerState,
} from ".."

describe("Server", () => {
  let logger: ReturnType<typeof mock<Logger>>
  let clock: FakeClock
  let deps: ServerDependencies
  let options: ResolvedServerOptions
  let app: ReturnType<typeof mock<Application>>
  let collabs: ServerCollaborators

  beforeEach(() => {
    logger = mock<Logger>()
    clock = new FakeClock(0)
    deps = { logger, clock }
    app = mock<Application>()

    options = {
      port: 3000,
      host: "0.0.0.0",
      startupTimeoutMs: 30_000,
      shutdownTimeoutMs: 10_000,
      requestId: { enabled: false },
      requestLogging: { enabled: false },
      health: { enabled: false },
      clientIp: { enabled: false },
      errorHandling: { kind: "mappings", config: { mappings: {} } },
      routes: vi.fn(),
      middleware: { pre: [], post: [] },
      createApp: () => app,
      startHooks: [],
      stopHooks: [],
    } as ResolvedServerOptions

    collabs = {
      onStartup: vi.fn(async () => ({ ok: true, failures: [], timedOut: false })),
      onShutdown: vi.fn(async () => ({ ok: true, failures: [], timedOut: false })),
      listen: vi.fn(() => ({ close: vi.fn((cb) => cb?.()) })),
      buildApp: vi.fn(() => app),
      createStopper: vi.fn(() => ({
        stop: vi.fn(() => Promise.resolve({ ok: true, failures: [], timedOut: false })),
        address: { host: "0.0.0.0", port: 3000 },
      })),
      createDefaultMiddleware: vi.fn(() => []),
      createErrorHandler: vi.fn(() => vi.fn()),
      setupProcessHandlers: vi.fn(() => ({ unregister: vi.fn() })),
    }
  })

  function createServer(overrides?: Partial<ServerCollaborators>): Server {
    return new Server(deps, options, { ...collabs, ...overrides })
  }

  describe("construction", () => {
    it("initializes in idle state", () => {
      const server = createServer()

      expect(server.getState()).toBe("idle")
      expect(server.isReady()).toBe(false)
    })

    it("initializes as not built", () => {
      const server = createServer()

      expect(server.isBuilt()).toBe(false)
    })

    it("creates app from options", () => {
      const createApp = vi.fn(() => app)
      options.createApp = createApp

      const server = createServer()

      expect(server.app).toBe(app)
      expect(createApp).toHaveBeenCalled()
    })
  })

  describe("build", () => {
    it("returns this for chaining", () => {
      const server = createServer()

      const result = server.build()

      expect(result).toBe(server)
    })

    it("is idempotent", () => {
      const server = createServer()

      server.build()
      server.build()

      expect(collabs.buildApp).toHaveBeenCalledTimes(1)
    })

    it("marks server as built", () => {
      const server = createServer()

      expect(server.isBuilt()).toBe(false)

      server.build()

      expect(server.isBuilt()).toBe(true)
    })

    it("builds app with options", () => {
      const server = createServer()

      server.build()

      expect(collabs.buildApp).toHaveBeenCalledWith(expect.objectContaining({ options }))
    })

    it("provides live readiness accessor", () => {
      const server = createServer()

      server.build()

      const call = vi.mocked(collabs.buildApp).mock.calls[0]![0]
      expect(typeof call.isReady).toBe("function")
    })

    it("wires default middleware", () => {
      const middleware: Middleware[] = [vi.fn() as any]
      const server = createServer({
        createDefaultMiddleware: vi.fn(() => middleware),
      })

      server.build()

      expect(collabs.buildApp).toHaveBeenCalledWith(
        expect.objectContaining({ defaultMiddleware: middleware }),
      )
    })

    it("wires error handler", () => {
      const errorHandler = vi.fn()
      const server = createServer({
        createErrorHandler: vi.fn(() => errorHandler),
      })

      server.build()

      const call = vi.mocked(collabs.buildApp).mock.calls[0]![0]
      expect(call.createErrorHandler()).toBe(errorHandler)
    })

    it("allows app.request() after build without start", async () => {
      const realApp = new Hono()

      options.createApp = () => realApp

      const server = new Server(deps, options, {
        ...collabs,
        buildApp: vi.fn(({ createApp }) => {
          const builtApp = createApp()
          builtApp.get("/health", (c: Context) => c.json({ status: "ok" }))
          return builtApp
        }),
      })

      server.build()

      const res = await server.app.request("/health")
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toEqual({ status: "ok" })
    })
  })

  describe("state transitions", () => {
    it("throws if start called when already starting", async () => {
      const server = createServer({
        onStartup: () => new Promise(() => {}),
      })

      server.start()

      await expect(server.start()).rejects.toThrow("Server already started")
    })

    it("throws if start called when already started", async () => {
      const server = createServer()

      await server.start()

      await expect(server.start()).rejects.toThrow("Server already started")
    })

    it("transitions idle → starting → started on success", async () => {
      const states: ServerState[] = []
      const server = createServer({
        onStartup: vi.fn(async () => {
          states.push(server.getState())
          return { ok: true, failures: [], timedOut: false }
        }),
        createStopper: vi.fn(() => {
          states.push(server.getState())
          return {
            stop: vi.fn(() =>
              Promise.resolve({ ok: true, failures: [], timedOut: false }),
            ),
            address: { host: "0.0.0.0", port: 3000 },
          }
        }),
      })

      await server.start()
      states.push(server.getState())

      expect(states).toEqual(["starting", "starting", "started"])
    })

    it("transitions idle → starting → idle on failure", async () => {
      const server = createServer({
        onStartup: vi.fn().mockRejectedValue(new Error("startup failed")),
      })

      await expect(server.start()).rejects.toThrow("startup failed")

      expect(server.getState()).toBe("idle")
    })
  })

  describe("startup lifecycle", () => {
    it("runs startup hooks before building app", async () => {
      const order: string[] = []

      const server = createServer({
        onStartup: vi.fn(async () => {
          order.push("startup")
          return { ok: true, failures: [], timedOut: false }
        }),
        buildApp: vi.fn(() => {
          order.push("buildApp")
          return app
        }),
      })

      await server.start()

      expect(order).toEqual(["startup", "buildApp"])
    })

    it("computes deadline from clock + timeout", async () => {
      clock.set(1000)
      options.startupTimeoutMs = 5_000

      const server = createServer()
      await server.start()

      expect(collabs.onStartup).toHaveBeenCalledWith(
        expect.objectContaining({ deadlineMs: 6_000 }),
      )
    })

    it("propagates startup hook failures", async () => {
      const server = createServer({
        onStartup: vi.fn().mockRejectedValue(new Error("hook failed")),
      })

      await expect(server.start()).rejects.toThrow("hook failed")
    })
  })

  describe("start with pre-built app", () => {
    it("skips buildApp if already built", async () => {
      const server = createServer()

      server.build()
      await server.start()

      expect(collabs.buildApp).toHaveBeenCalledTimes(1)
    })

    it("calls buildApp if not pre-built", async () => {
      const server = createServer()

      await server.start()

      expect(collabs.buildApp).toHaveBeenCalledTimes(1)
    })
  })

  describe("server binding", () => {
    it("listens after building app", async () => {
      const order: string[] = []

      const server = createServer({
        buildApp: vi.fn(() => {
          order.push("buildApp")
          return app
        }),
        listen: vi.fn(() => {
          order.push("listen")
          return { close: vi.fn((cb) => cb?.()) }
        }),
      })

      await server.start()

      expect(order).toEqual(["buildApp", "listen"])
    })

    it("propagates listen errors", async () => {
      const server = createServer({
        listen: vi.fn(() => {
          throw new Error("bind failed")
        }),
      })

      await expect(server.start()).rejects.toThrow("bind failed")
    })
  })

  describe("readiness", () => {
    it("marks ready after successful start", async () => {
      const server = createServer()

      expect(server.isReady()).toBe(false)

      await server.start()

      expect(server.isReady()).toBe(true)
    })

    it("resets ready on failure", async () => {
      const server = createServer({
        listen: vi.fn(() => {
          throw new Error("fail")
        }),
      })

      await expect(server.start()).rejects.toThrow()

      expect(server.isReady()).toBe(false)
    })
  })

  describe("stopper integration", () => {
    it("passes stop hooks to createStopper", async () => {
      const stopHooks = [{ name: "test", fn: vi.fn() }]
      options.stopHooks = stopHooks

      const server = createServer()
      await server.start()

      expect(collabs.createStopper).toHaveBeenCalledWith(
        expect.objectContaining({ stopHooks }),
      )
    })

    it("passes shutdown timeout via options", async () => {
      options.shutdownTimeoutMs = 15_000

      const server = createServer()
      await server.start()

      expect(collabs.createStopper).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ shutdownTimeoutMs: 15_000 }),
        }),
      )
    })

    it("returns the server handle from start", async () => {
      const handle: ServerHandle = {
        stop: vi.fn(() => Promise.resolve({ ok: true, failures: [], timedOut: false })),
        address: { host: "127.0.0.1", port: 8080 },
      }

      const server = createServer({
        createStopper: vi.fn(() => handle),
      })

      const result = await server.start()

      expect(result).toBe(handle)
    })

    it("wires setReady to update server readiness", async () => {
      let capturedSetReady: ((v: boolean) => void) | undefined

      const server = createServer({
        createStopper: vi.fn((ctx) => {
          capturedSetReady = ctx.setReady
          return {
            stop: vi.fn(() =>
              Promise.resolve({ ok: true, failures: [], timedOut: false }),
            ),
            address: { host: "0.0.0.0", port: 3000 },
          }
        }),
      })

      await server.start()
      expect(server.isReady()).toBe(true)

      capturedSetReady!(false)
      expect(server.isReady()).toBe(false)

      capturedSetReady!(true)
      expect(server.isReady()).toBe(true)
    })
  })

  describe("signal handler integration", () => {
    it("unregisters signal handler on stop callback", async () => {
      const unregister = vi.fn()
      let capturedOnStop: (() => void) | undefined

      const server = createServer({
        setupProcessHandlers: vi.fn(() => ({ unregister })),
        createStopper: vi.fn((ctx) => {
          capturedOnStop = ctx.onStop
          return {
            stop: vi.fn(() =>
              Promise.resolve({ ok: true, failures: [], timedOut: false }),
            ),
            address: { host: "0.0.0.0", port: 3000 },
          }
        }),
      })

      server.setupProcessHandlers()
      await server.start()
      capturedOnStop!()

      expect(unregister).toHaveBeenCalled()
    })

    it("handles missing signal handler gracefully", async () => {
      let capturedOnStop: (() => void) | undefined

      const server = createServer({
        createStopper: vi.fn((ctx) => {
          capturedOnStop = ctx.onStop
          return {
            stop: vi.fn(() =>
              Promise.resolve({ ok: true, failures: [], timedOut: false }),
            ),
            address: { host: "0.0.0.0", port: 3000 },
          }
        }),
      })

      await server.start()

      expect(() => capturedOnStop!()).not.toThrow()
    })
  })

  describe("error handling", () => {
    it("resets state on buildApp failure", async () => {
      const server = createServer({
        buildApp: vi.fn(() => {
          throw new Error("build failed")
        }),
      })

      await expect(server.start()).rejects.toThrow("build failed")

      expect(server.getState()).toBe("idle")
      expect(server.isReady()).toBe(false)
    })

    it("resets state on createStopper failure", async () => {
      const server = createServer({
        createStopper: vi.fn(() => {
          throw new Error("stopper failed")
        }),
      })

      await expect(server.start()).rejects.toThrow("stopper failed")

      expect(server.getState()).toBe("idle")
    })

    it("resets built state on startup failure", async () => {
      const server = createServer({
        onStartup: vi.fn().mockRejectedValue(new Error("startup failed")),
      })

      server.build()
      expect(server.isBuilt()).toBe(true)

      await expect(server.start()).rejects.toThrow("startup failed")

      expect(server.isBuilt()).toBe(true) // built state preserved
      expect(server.getState()).toBe("idle")
    })
  })

  describe("setupProcessHandlers", () => {
    it("returns this for chaining", () => {
      const server = createServer()

      const result = server.setupProcessHandlers()

      expect(result).toBe(server)
    })

    it("is idempotent", () => {
      const server = createServer()

      server.setupProcessHandlers()
      server.setupProcessHandlers()

      expect(collabs.setupProcessHandlers).toHaveBeenCalledTimes(1)
    })

    it("wires stop to running server when available", async () => {
      const stopResult: StopResult = { ok: true, failures: [], timedOut: false }
      const stop = vi.fn(() => Promise.resolve(stopResult))

      let capturedStop: (() => Promise<any>) | undefined

      const server = createServer({
        setupProcessHandlers: vi.fn((ctx) => {
          capturedStop = ctx.stop
          return { unregister: vi.fn() }
        }),
        createStopper: vi.fn(() => ({
          stop,
          address: { host: "0.0.0.0", port: 3000 },
        })),
      })

      server.setupProcessHandlers()
      await server.start()

      const result = await capturedStop!()

      expect(stop).toHaveBeenCalled()
      expect(result).toBe(stopResult)
    })

    it("returns noop result when stop called before server running", async () => {
      let capturedStop: (() => Promise<any>) | undefined

      const server = createServer({
        setupProcessHandlers: vi.fn((ctx) => {
          capturedStop = ctx.stop
          return { unregister: vi.fn() }
        }),
      })

      server.setupProcessHandlers()

      const result = await capturedStop!()

      expect(result).toEqual({ ok: true, failures: [], timedOut: false })
      expect(logger.warn).toHaveBeenCalledWith("Stop called but server not running")
    })
  })

  describe("orchestration order", () => {
    it("executes full startup sequence in order", async () => {
      const order: string[] = []

      const server = createServer({
        onStartup: vi.fn(async () => {
          order.push("startup")
          return { ok: true, failures: [], timedOut: false }
        }),
        buildApp: vi.fn(() => {
          order.push("buildApp")
          return app
        }),
        listen: vi.fn(() => {
          order.push("listen")
          return { close: vi.fn((cb) => cb?.()) }
        }),
        createStopper: vi.fn(() => {
          order.push("createStopper")
          return {
            stop: vi.fn(() =>
              Promise.resolve({ ok: true, failures: [], timedOut: false }),
            ),
            address: { host: "0.0.0.0", port: 3000 },
          }
        }),
      })

      await server.start()

      expect(order).toEqual(["startup", "buildApp", "listen", "createStopper"])
    })

    it("executes startup sequence with pre-built app", async () => {
      const order: string[] = []

      const server = createServer({
        onStartup: vi.fn(async () => {
          order.push("startup")
          return { ok: true, failures: [], timedOut: false }
        }),
        buildApp: vi.fn(() => {
          order.push("buildApp")
          return app
        }),
        listen: vi.fn(() => {
          order.push("listen")
          return { close: vi.fn((cb) => cb?.()) }
        }),
        createStopper: vi.fn(() => {
          order.push("createStopper")
          return {
            stop: vi.fn(() =>
              Promise.resolve({ ok: true, failures: [], timedOut: false }),
            ),
            address: { host: "0.0.0.0", port: 3000 },
          }
        }),
      })

      server.build()
      order.length = 0 // reset after build

      await server.start()

      expect(order).toEqual(["startup", "listen", "createStopper"])
    })
  })
})
