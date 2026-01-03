import { mock } from "vitest-mock-extended"
import type { Application, Middleware } from "../../create-server"
import { resolveOptions, type ServerOptions } from "../../server-options"
import type { Mock } from "../../tests/mock"
import { buildApp } from "../build-app"

describe("buildApp", () => {
  function makeOptions(overrides: Partial<ServerOptions> = {}) {
    return resolveOptions({
      port: 1234,
      errorHandling: { kind: "mappings", config: { mappings: {} } },
      routes: () => {},
      ...overrides,
    })
  }

  describe("wiring & ordering", () => {
    it("wires middleware in the expected order", () => {
      const d1: Mock<Middleware> = mock<Middleware>()
      const d2: Mock<Middleware> = mock<Middleware>()
      const p1: Mock<Middleware> = mock<Middleware>()
      const o1: Mock<Middleware> = mock<Middleware>()
      const o2: Mock<Middleware> = mock<Middleware>()

      const app: Mock<Application> = mock<Application>()

      const routes = vi.fn(() => {})

      const options = makeOptions({
        middleware: {
          pre: [p1],
          post: [o1, o2],
        },
        routes,
      })

      buildApp({
        isReady: () => true,
        createApp: () => app,
        createErrorHandler: () => vi.fn(),
        options,
        defaultMiddleware: [d1, d2],
      })

      expect(app.use).toHaveBeenNthCalledWith(1, "*", d1)
      expect(app.use).toHaveBeenNthCalledWith(2, "*", d2)

      expect(app.use).toHaveBeenNthCalledWith(3, "*", p1)

      expect(routes).toHaveBeenCalledTimes(1)

      expect(app.use).toHaveBeenNthCalledWith(4, "*", o1)
      expect(app.use).toHaveBeenNthCalledWith(5, "*", o2)
    })
  })

  describe("default middleware", () => {
    it("applies the provided defaultMiddleware list", () => {
      const d1: Mock<Middleware> = mock<Middleware>()
      const d2: Mock<Middleware> = mock<Middleware>()

      const app: Mock<Application> = mock<Application>()
      const options = makeOptions({ middleware: { pre: [], post: [] } })

      buildApp({
        isReady: () => true,
        createApp: () => app,
        createErrorHandler: () => vi.fn(),
        options,
        defaultMiddleware: [d1, d2],
      })

      expect(app.use).toHaveBeenNthCalledWith(1, "*", d1)
      expect(app.use).toHaveBeenNthCalledWith(2, "*", d2)
    })

    it("skips defaultMiddleware when the list is empty", () => {
      const p1: Mock<Middleware> = mock<Middleware>()
      const o1: Mock<Middleware> = mock<Middleware>()
      const o2: Mock<Middleware> = mock<Middleware>()

      const app: Mock<Application> = mock<Application>()

      const routes = vi.fn(() => {})

      const options = makeOptions({
        middleware: {
          pre: [p1],
          post: [o1, o2],
        },
        routes,
      })

      buildApp({
        isReady: () => true,
        createApp: () => app,
        createErrorHandler: () => vi.fn(),
        options,
        defaultMiddleware: [],
      })

      expect(app.use).toHaveBeenNthCalledWith(1, "*", p1)

      expect(routes).toHaveBeenCalledTimes(1)

      expect(app.use).toHaveBeenNthCalledWith(2, "*", o1)
      expect(app.use).toHaveBeenNthCalledWith(3, "*", o2)
    })
  })

  describe("health routes", () => {
    it("registers health routes when enabled", () => {
      const app: Mock<Application> = mock<Application>()
      const isReady = vi.fn(() => true)

      const options = makeOptions({
        health: { enabled: true, livenessPath: "/health", readinessPath: "/ready" },
      })

      buildApp({
        isReady,
        createApp: () => app,
        createErrorHandler: () => vi.fn(),
        options,
        defaultMiddleware: [],
      })

      expect(app.get).toHaveBeenCalledWith("/health", expect.any(Function))
      expect(app.get).toHaveBeenCalledWith("/ready", expect.any(Function))
    })

    it("does not register health routes when disabled", () => {
      const app: Mock<Application> = mock<Application>()
      const isReady = vi.fn(() => true)

      const options = makeOptions({
        health: { enabled: false },
      })

      buildApp({
        isReady,
        createApp: () => app,
        createErrorHandler: () => vi.fn(),
        options,
        defaultMiddleware: [],
      })

      expect(app.get).not.toHaveBeenCalledWith("/health", expect.any(Function))
      expect(app.get).not.toHaveBeenCalledWith("/ready", expect.any(Function))
    })
  })

  describe("routes callback", () => {
    it("invokes options.routes with the app instance exactly once", () => {
      const app: Mock<Application> = mock<Application>()
      const routes = vi.fn()

      const options = makeOptions({ routes, middleware: { pre: [], post: [] } })

      buildApp({
        isReady: () => true,
        createApp: () => app,
        createErrorHandler: () => vi.fn(),
        options,
        defaultMiddleware: [],
      })

      expect(routes).toHaveBeenCalledTimes(1)
      expect(routes).toHaveBeenCalledWith(app)
    })
  })

  describe("error handler registration", () => {
    it("registers the created handler via app.onError(handler)", () => {
      const app: Mock<Application> = mock<Application>()
      const handler = vi.fn()
      const createErrorHandler = vi.fn(() => handler)

      const options = makeOptions({ middleware: { pre: [], post: [] } })

      buildApp({
        isReady: () => true,
        createApp: () => app,
        createErrorHandler,
        options,
        defaultMiddleware: [],
      })

      expect(createErrorHandler).toHaveBeenCalledTimes(1)
      expect(app.onError).toHaveBeenCalledExactlyOnceWith(handler)
    })
  })

  describe("edge cases", () => {
    it("throws if options.routes throws during build", () => {
      const app: Mock<Application> = mock<Application>()
      const boom = new Error("boom")

      const options = makeOptions({
        middleware: { pre: [], post: [] },
        routes: () => {
          throw boom
        },
      })

      expect(() =>
        buildApp({
          isReady: () => true,
          createApp: () => app,
          createErrorHandler: () => vi.fn(),
          options,
          defaultMiddleware: [],
        }),
      ).toThrow(boom)
    })
  })
})
