import { FakeClock } from "@subspace/clock"
import type { Logger } from "@subspace/logger"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { mock } from "vitest-mock-extended"
import type { Application, Middleware } from "../../create-server"
import type { ResolvedServerOptions, ServerDependencies } from "../../server-options"
import type { Mock, MockFunction } from "../../tests/mock"
import type { BuildAppFn } from "../build-app"
import type { CreateStopperFn, ServerHandle } from "../create-stopper"
import type { ListenFn } from "../listen"
import type { ShutdownFn } from "../shutdown"
import type { SignalHandler } from "../signals"
import { type ServerState, type StartServerContext, startServer } from "../start-server"
import type { StartupFn } from "../startup"

describe("startServer", () => {
  let logger: Mock<Logger>
  let clock: FakeClock
  let deps: ServerDependencies
  let options: ResolvedServerOptions

  let state: ServerState
  let ready: boolean
  let serverHandle: ServerHandle | undefined
  let signalHandler: SignalHandler | undefined

  let app: Mock<Application>
  let buildApp: MockFunction<BuildAppFn>
  let listen: MockFunction<ListenFn>
  let createStopper: MockFunction<CreateStopperFn>
  let createDefaultMiddleware: MockFunction<() => Middleware[]>
  let createErrorHandler: MockFunction<
    (options: ResolvedServerOptions, logger: Logger) => any
  >
  let onStartup: MockFunction<StartupFn>
  let onShutdown: MockFunction<ShutdownFn>

  beforeEach(() => {
    app = mock<Application>()
    buildApp = vi.fn(() => app)
    listen = vi.fn(() => ({ close: vi.fn((cb) => cb?.()) }))
    createStopper = vi.fn(() => ({
      stop: vi.fn(() => Promise.resolve({ ok: true, failures: [], timedOut: false })),
      address: { host: "0.0.0.0", port: 3000 },
    }))
    createDefaultMiddleware = vi.fn(() => [])
    createErrorHandler = vi.fn(() => vi.fn() as any)
    onStartup = vi.fn(async () => ({ ok: true, failures: [], timedOut: false }))
    onShutdown = vi.fn(async () => ({ ok: true, failures: [], timedOut: false }))

    logger = mock<Logger>()
    clock = new FakeClock(0)
    deps = { logger, clock }

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
      beforeStart: [],
      beforeStop: [],
    } as ResolvedServerOptions

    state = "idle"
    ready = false
    serverHandle = undefined
    signalHandler = undefined
  })

  function createCtx(overrides?: Partial<StartServerContext>): StartServerContext {
    return {
      deps,
      options,
      getState: () => state,
      setState: (s) => {
        state = s
      },
      getReady: () => ready,
      setReady: (v) => {
        ready = v
      },
      setRunningServer: (s) => {
        serverHandle = s
      },
      getSignalHandler: () => signalHandler,
      collabs: {
        onStartup,
        onShutdown,
        listen,
        buildApp,
        createStopper,
        createApp: () => app,
        createDefaultMiddleware,
        createErrorHandler,
      },
      ...overrides,
    }
  }

  describe("state transitions", () => {
    it("throws if called when already starting", async () => {
      state = "starting"

      await expect(startServer(createCtx())).rejects.toThrow("Server already started")
    })

    it("throws if called when already started", async () => {
      state = "started"

      await expect(startServer(createCtx())).rejects.toThrow("Server already started")
    })

    it("transitions idle → starting → started on success", async () => {
      const states: ServerState[] = []
      const ctx = createCtx({
        setState: (s) => {
          state = s
          states.push(s)
        },
      })

      await startServer(ctx)

      expect(states).toEqual(["starting", "started"])
    })

    it("transitions idle → starting → idle on failure", async () => {
      onStartup.mockRejectedValueOnce(new Error("startup failed"))

      const states: ServerState[] = []
      const ctx = createCtx({
        setState: (s) => {
          state = s
          states.push(s)
        },
      })

      await expect(startServer(ctx)).rejects.toThrow("startup failed")

      expect(states).toEqual(["starting", "idle"])
    })

    it("rejects concurrent start calls while starting", async () => {
      let resolveStartup: () => void
      onStartup.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStartup = () => resolve({ ok: true, failures: [], timedOut: false })
          }),
      )

      const ctx = createCtx()

      const first = startServer(ctx)
      const second = startServer(ctx)

      await expect(second).rejects.toThrow("Server already started")

      resolveStartup!()
      await first
    })
  })

  describe("startup lifecycle", () => {
    it("runs startup hooks before creating the application", async () => {
      const order: string[] = []

      onStartup.mockImplementationOnce(async () => {
        order.push("startup")
        return { ok: true, failures: [], timedOut: false }
      })

      buildApp.mockImplementationOnce(() => {
        order.push("buildApp")
        return { fetch: vi.fn() } as any
      })

      await startServer(createCtx())

      expect(order).toEqual(["startup", "buildApp"])
    })

    it("uses the configured startup timeout to derive a deadline", async () => {
      clock.set(1000)
      options.startupTimeoutMs = 5_000

      await startServer(createCtx())

      expect(onStartup).toHaveBeenCalledWith(
        expect.objectContaining({
          deadlineMs: 6_000,
        }),
      )
    })

    it("fails when startup hooks fail", async () => {
      onStartup.mockRejectedValueOnce(new Error("hook failed"))

      await expect(startServer(createCtx())).rejects.toThrow("hook failed")
    })

    it("fails when startup hooks time out", async () => {
      onStartup.mockRejectedValueOnce(new Error("startup timed out"))

      await expect(startServer(createCtx())).rejects.toThrow("startup timed out")
    })
  })

  describe("application and binding", () => {
    it("creates the application using the provided config/options/logger", async () => {
      await startServer(createCtx())

      expect(buildApp).toHaveBeenCalledWith(
        expect.objectContaining({
          options,
        }),
      )
    })

    it("passes DI collaborators through to buildApp", async () => {
      const defaults: Middleware[] = [vi.fn(async (_c, next) => next()) as any]
      const errHandler = vi.fn() as any

      createDefaultMiddleware.mockReturnValueOnce(defaults)
      createErrorHandler.mockReturnValueOnce(errHandler)

      await startServer(createCtx())

      expect(buildApp).toHaveBeenCalledWith(
        expect.objectContaining({
          options,
          isReady: expect.any(Function),
          createApp: expect.any(Function),
          createErrorHandler: expect.any(Function),
          defaultMiddleware: defaults,
        }),
      )
    })

    it("provides a readiness accessor to the application", async () => {
      await startServer(createCtx())

      const buildAppCall = vi.mocked(buildApp).mock.calls[0]![0]

      expect(buildAppCall.isReady).toBeDefined()
      expect(typeof buildAppCall.isReady).toBe("function")
    })

    it("binds the server after the application is created", async () => {
      const order: string[] = []

      buildApp.mockImplementationOnce(() => {
        order.push("buildApp")
        return { fetch: vi.fn() } as any
      })

      listen.mockImplementationOnce(() => {
        order.push("bindServer")
        return { close: vi.fn((cb) => cb?.()) }
      })

      await startServer(createCtx())

      expect(order).toEqual(["buildApp", "bindServer"])
    })
  })

  describe("readiness handling", () => {
    it("marks the server ready after successful start", async () => {
      const ctx = createCtx()

      await startServer(ctx)

      expect(ready).toBe(true)
    })

    it("marks the server not ready on failure", async () => {
      onStartup.mockRejectedValueOnce(new Error("failed"))

      ready = true

      const ctx = createCtx()

      await expect(startServer(ctx)).rejects.toThrow()

      expect(ready).toBe(false)
    })
  })

  describe("shutdown integration", () => {
    it("wires stop hooks into the running server", async () => {
      const stopHooks = [{ name: "test", fn: vi.fn() }]

      options.beforeStop = stopHooks

      await startServer(createCtx())

      expect(createStopper).toHaveBeenCalledWith(
        expect.objectContaining({
          stopHooks,
        }),
      )
    })

    it("un-registers signal handlers when the server stops", async () => {
      const unregister = vi.fn()
      signalHandler = { unregister }

      await startServer(createCtx())

      const runningServerCall = vi.mocked(createStopper).mock.calls[0]![0]
      runningServerCall.onStop()

      expect(unregister).toHaveBeenCalled()
    })

    it("uses the configured shutdown timeout for graceful stop", async () => {
      options.shutdownTimeoutMs = 15_000

      await startServer(createCtx())

      expect(createStopper).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            shutdownTimeoutMs: 15_000,
          }),
        }),
      )
    })
  })

  describe("signal handling integration", () => {
    it("does not attempt to unregister signals if no handler is present", async () => {
      signalHandler = undefined

      await startServer(createCtx())

      const runningServerCall = vi.mocked(createStopper).mock.calls[0]![0]

      expect(() => runningServerCall.onStop()).not.toThrow()
    })
  })

  describe("error propagation", () => {
    it("rethrows errors from startup", async () => {
      const error = new Error("startup boom")

      onStartup.mockRejectedValueOnce(error)

      await expect(startServer(createCtx())).rejects.toThrow(error)
    })

    it("rethrows errors from application creation", async () => {
      const error = new Error("build boom")

      buildApp.mockImplementationOnce(() => {
        throw error
      })

      await expect(startServer(createCtx())).rejects.toThrow(error)
    })

    it("rethrows errors from server binding", async () => {
      const error = new Error("bind boom")

      listen.mockImplementationOnce(() => {
        throw error
      })

      await expect(startServer(createCtx())).rejects.toThrow(error)
    })

    it("does not leave the server in a started state after failure", async () => {
      listen.mockImplementationOnce(() => {
        throw new Error("fail")
      })

      await expect(startServer(createCtx())).rejects.toThrow()

      expect(state).toBe("idle")
    })
  })

  describe("high-level flow", () => {
    it("performs the expected start sequence", async () => {
      const order: string[] = []

      onStartup.mockImplementationOnce(async () => {
        order.push("startup")
        return { ok: true, failures: [], timedOut: false }
      })

      buildApp.mockImplementationOnce(() => {
        order.push("buildApp")
        return { fetch: vi.fn() } as any
      })

      listen.mockImplementationOnce(() => {
        order.push("bindServer")
        return { close: vi.fn((cb) => cb?.()) }
      })

      createStopper.mockImplementationOnce(() => {
        order.push("createRunningServer")
        return {
          stop: vi.fn(),
          address: { host: "0.0.0.0", port: 3000 },
        }
      })

      const ctx = createCtx({
        setRunningServer: () => {
          order.push("setRunningServer")
        },
        setReady: () => {
          order.push("setReady")
        },
        setState: (s) => {
          state = s
          if (s === "started") order.push("setState:started")
        },
      })

      await startServer(ctx)

      expect(order).toEqual([
        "startup",
        "buildApp",
        "bindServer",
        "createRunningServer",
        "setRunningServer",
        "setReady",
        "setState:started",
      ])
    })
  })

  describe("return value", () => {
    it("returns a running server on success", async () => {
      const result = await startServer(createCtx())

      expect(result).toBeDefined()
      expect(result.stop).toBeDefined()
      expect(result.address).toBeDefined()
    })

    it("stores the running server in context", async () => {
      const ctx = createCtx()

      const result = await startServer(ctx)

      expect(serverHandle).toBe(result)
    })
  })
})
