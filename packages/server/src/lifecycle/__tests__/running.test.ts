import { type Clock, FakeClock } from "@subspace/clock"
import type { Logger } from "@subspace/logger"
import type { Mock } from "vitest"
import { mock } from "vitest-mock-extended"
import { createApp } from "../../create-server"
import type { ResolvedServerOptions, ServerDependencies } from "../../server-options"
import { createStopper } from "../create-stopper"
import type { LifecycleHook } from "../lifecycle-hook"
import type { Closeable } from "../shutdown"

function createDeps(overrides: Partial<ServerDependencies> = {}): ServerDependencies {
  const clock: Clock = new FakeClock(0)

  return {
    logger: mock<Logger>(),
    clock,
    ...overrides,
  }
}

function createOptions(
  overrides: Partial<ResolvedServerOptions> = {},
): ResolvedServerOptions {
  return {
    port: 3000,
    host: "0.0.0.0",
    shutdownTimeoutMs: 10_000,
    startupTimeoutMs: 10_000,

    requestId: { enabled: false } as any,
    requestLogging: { enabled: false } as any,
    health: { enabled: false } as any,
    clientIp: { enabled: false } as any,

    createApp,

    middleware: { pre: [], post: [] },
    routes: () => {},
    startHooks: [],
    stopHooks: [],

    errorHandling: { kind: "mappings", config: { mappings: {} } },
    ...overrides,
  }
}

describe("createRunningServer", () => {
  let deps: ServerDependencies
  let options: ResolvedServerOptions
  let server: Closeable
  let stopHooks: LifecycleHook[]

  let setReady: Mock
  let onStop: Mock
  let shutdownFn: Mock

  beforeEach(() => {
    deps = createDeps()
    options = createOptions({ host: "127.0.0.1", port: 4663, shutdownTimeoutMs: 1234 })

    server = { close: vi.fn() }
    stopHooks = [{ name: "hook.a", fn: vi.fn(async () => {}) }]

    setReady = vi.fn()
    onStop = vi.fn()
    shutdownFn = vi.fn()
  })

  describe("stop()", () => {
    it("passes the expected shutdown inputs", async () => {
      shutdownFn.mockResolvedValue({
        ok: true,
        failures: [],
        timedOut: false,
      })

      const running = createStopper({
        server,
        deps,
        options,
        stopHooks,
        setReady,
        onStop,
        shutdown: shutdownFn,
      })

      await running.stop()

      expect(shutdownFn).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          server,
          deps,
          stopHooks,
          deadlineMs: expect.any(Number),
        }),
      )
    })

    it("derives the shutdown deadline from the clock and configured timeout", async () => {
      const clock: Clock = new FakeClock(1_000)

      deps = createDeps({ clock })
      options = createOptions({ shutdownTimeoutMs: 500 })

      shutdownFn.mockResolvedValue({
        ok: true,
        failures: [],
        timedOut: false,
      })

      const running = createStopper({
        server,
        deps,
        options,
        stopHooks,
        setReady,
        onStop,
        shutdown: shutdownFn,
      })

      await running.stop()

      expect(shutdownFn).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          deadlineMs: 1_500,
        }),
      )
    })

    it("executes shutdown lifecycle in a stable order", async () => {
      const order: string[] = []

      const readyMock = vi.fn((v: any) => {
        order.push(`setReady:${String(v)}`)
      })

      const onStopMock = vi.fn(() => {
        order.push("onStop")
      })

      shutdownFn.mockImplementation(async () => {
        order.push("shutdown")
        return { ok: true, failures: [], timedOut: false }
      })

      const running = createStopper({
        server,
        deps,
        options,
        stopHooks,
        setReady: readyMock,
        onStop: onStopMock,
        shutdown: shutdownFn,
      })

      await running.stop()

      expect(order).toStrictEqual(["setReady:false", "shutdown", "onStop"])
    })
  })

  describe("idempotency", () => {
    it("concurrent stop calls share the same in-flight shutdown", async () => {
      let resolve: ((v: any) => void) | undefined
      const p = new Promise((r) => {
        resolve = r
      })

      shutdownFn.mockReturnValue(p)

      const running = createStopper({
        server,
        deps,
        options,
        stopHooks,
        setReady,
        onStop,
        shutdown: shutdownFn,
      })

      const a = running.stop()
      const b = running.stop()

      expect(a).toStrictEqual(b)
      expect(shutdownFn).toHaveBeenCalledOnce()

      resolve?.({ ok: true, failures: [], timedOut: false })

      const [ra, rb] = await Promise.all([a, b])

      expect(ra).toStrictEqual({ ok: true, failures: [], timedOut: false })
      expect(rb).toStrictEqual({ ok: true, failures: [], timedOut: false })
    })

    it("does not re-run pre-shutdown side effects on subsequent stop calls", async () => {
      shutdownFn.mockResolvedValue({
        ok: true,
        failures: [],
        timedOut: false,
      })

      const running = createStopper({
        server,
        deps,
        options,
        stopHooks,
        setReady,
        onStop,
        shutdown: shutdownFn,
      })

      await running.stop()
      await running.stop()

      expect(setReady).toHaveBeenCalledExactlyOnceWith(false)
      expect(shutdownFn).toHaveBeenCalledOnce()
      expect(onStop).toHaveBeenCalledOnce()
    })
  })

  describe("shutdown outcomes", () => {
    it("returns the shutdown outcome produced by the shutdown routine", async () => {
      const outcome = {
        ok: false,
        failures: [{ hook: "x", error: new Error("boom") }],
        timedOut: false,
      }

      shutdownFn.mockResolvedValue(outcome)

      const running = createStopper({
        server,
        deps,
        options,
        stopHooks,
        setReady,
        onStop,
        shutdown: shutdownFn,
      })

      const result = await running.stop()

      expect(result).toStrictEqual(outcome)
    })

    it("propagates cleanup failures", async () => {
      const outcome = { ok: true, failures: [], timedOut: false }

      shutdownFn.mockResolvedValue(outcome)

      const onStopMock = vi.fn(() => {
        throw new Error("cleanup failed")
      })

      const running = createStopper({
        server,
        deps,
        options,
        stopHooks,
        setReady,
        onStop: onStopMock,
        shutdown: shutdownFn,
      })

      await expect(running.stop()).rejects.toThrow("cleanup failed")

      expect(shutdownFn).toHaveBeenCalledOnce()
    })
  })
})
