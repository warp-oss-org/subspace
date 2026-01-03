import { DEFAULTS, resolveOptions } from "../server-options"

describe("resolveOptions", () => {
  function baseConfig(overrides: any = {}) {
    return {
      port: 1234,
      errorHandling: { kind: "mappings", config: { mappings: {} } },
      ...overrides,
    }
  }
  describe("core fields", () => {
    it("uses provided port", () => {
      const resolved = resolveOptions({
        port: 4321,
        errorHandling: { kind: "mappings", config: { mappings: {} } },
      } as any)

      expect(resolved.port).toBe(4321)
    })

    it("defaults host when not provided", () => {
      const resolved = resolveOptions(baseConfig())

      expect(resolved.host).toBe(DEFAULTS.host)
    })

    it("uses provided host when set", () => {
      const resolved = resolveOptions(baseConfig({ host: "127.0.0.1" }))

      expect(resolved.host).toBe("127.0.0.1")
    })

    it("defaults startupTimeoutMs when not provided", () => {
      const resolved = resolveOptions(baseConfig())

      expect(resolved.startupTimeoutMs).toBe(DEFAULTS.startupTimeoutMs)
    })

    it("uses provided startupTimeoutMs when set", () => {
      const resolved = resolveOptions(baseConfig({ startupTimeoutMs: 2500 }))

      expect(resolved.startupTimeoutMs).toBe(2500)
    })

    it("defaults shutdownTimeoutMs when not provided", () => {
      const resolved = resolveOptions(baseConfig())

      expect(resolved.shutdownTimeoutMs).toBe(DEFAULTS.shutdownTimeoutMs)
    })

    it("uses provided shutdownTimeoutMs when set", () => {
      const resolved = resolveOptions(baseConfig({ shutdownTimeoutMs: 9999 }))

      expect(resolved.shutdownTimeoutMs).toBe(9999)
    })
  })

  describe("requestId", () => {
    it("defaults requestId to enabled with DEFAULTS when missing", () => {
      const resolved = resolveOptions(baseConfig())

      expect(resolved.requestId).toStrictEqual({
        enabled: true,
        header: DEFAULTS.requestId.header,
        fallbackToTraceparent: DEFAULTS.requestId.fallbackToTraceparent,
        generate: expect.any(Function),
      })
    })

    it("disables requestId when requestId.enabled is false", () => {
      const resolved = resolveOptions(baseConfig({ requestId: { enabled: false } }))
      expect(resolved.requestId).toEqual({ enabled: false })
    })

    it("merges requestId overrides onto DEFAULTS", () => {
      const generate = () => "id-123"

      const resolved = resolveOptions(
        baseConfig({
          requestId: {
            enabled: true,
            header: "X-Request-Id",
            fallbackToTraceparent: true,
            generate,
          },
        }),
      )
      expect(resolved.requestId).toStrictEqual({
        enabled: true,
        header: "X-Request-Id",
        fallbackToTraceparent: true,
        generate,
      })
    })
  })

  describe("health", () => {
    it("defaults health to enabled with DEFAULTS when missing", () => {
      const resolved = resolveOptions(baseConfig())

      expect(resolved.health).toStrictEqual({
        enabled: true,
        livenessPath: DEFAULTS.health.livenessPath,
        readinessPath: DEFAULTS.health.readinessPath,
        checkTimeoutMs: DEFAULTS.health.checkTimeoutMs,
        readinessChecks: DEFAULTS.health.readinessChecks,
      })
    })

    it("disables health when health.enabled is false", () => {
      const resolved = resolveOptions(baseConfig({ health: { enabled: false } }))

      expect(resolved.health).toEqual({
        enabled: false,
      })
    })

    it("merges health overrides onto DEFAULTS", () => {
      const readinessFn = async () => true
      const config = {
        enabled: true,
        livenessPath: "/live",
        readinessPath: "/readyz",
        checkTimeoutMs: 1111,
        readinessChecks: [{ name: "x", fn: readinessFn }],
      }

      const resolved = resolveOptions(baseConfig({ health: config }))

      expect(resolved.health).toStrictEqual({
        enabled: true,
        livenessPath: "/live",
        readinessPath: "/readyz",
        checkTimeoutMs: 1111,
        readinessChecks: [{ name: "x", fn: readinessFn }],
      })
    })
  })

  describe("requestLogging", () => {
    it("defaults requestLogging to enabled with DEFAULTS when missing", () => {
      const resolved = resolveOptions(baseConfig())

      expect(resolved.requestLogging).toStrictEqual({
        enabled: true,
        level: DEFAULTS.requestLogging.level,
        ignorePaths: [DEFAULTS.health.livenessPath, DEFAULTS.health.readinessPath],
      })
    })

    it("disables requestLogging when requestLogging.enabled is false", () => {
      expect(
        resolveOptions(baseConfig({ requestLogging: { enabled: false } })).requestLogging,
      ).toEqual({ enabled: false })
    })

    it("defaults requestLogging.level when not provided", () => {
      const resolved: any = resolveOptions(
        baseConfig({ requestLogging: { enabled: true } }),
      )

      expect(resolved.requestLogging.level).toBe(DEFAULTS.requestLogging.level)
    })

    it("uses provided requestLogging.level when set", () => {
      const resolved: any = resolveOptions(
        baseConfig({ requestLogging: { enabled: true, level: "debug" } }),
      )

      expect(resolved.requestLogging.level).toBe("debug")
    })

    it("derives ignorePaths from health paths when health is enabled and ignorePaths not provided", () => {
      const resolved: any = resolveOptions(
        baseConfig({
          health: { enabled: true, livenessPath: "/h", readinessPath: "/r" },
          requestLogging: { enabled: true },
        }),
      )

      expect(resolved.requestLogging.ignorePaths).toEqual(["/h", "/r"])
    })

    it("defaults ignorePaths to [] when health is disabled and ignorePaths not provided", () => {
      const resolved: any = resolveOptions(
        baseConfig({
          health: { enabled: false },
          requestLogging: { enabled: true },
        }),
      )

      expect(resolved.requestLogging.ignorePaths).toEqual([])
    })

    it("uses provided ignorePaths when set", () => {
      const ignorePaths = ["/a", "/b"]
      const resolved: any = resolveOptions(
        baseConfig({
          requestLogging: { enabled: true, ignorePaths },
        }),
      )
      expect(resolved.requestLogging.ignorePaths).toEqual(ignorePaths)
    })
  })

  describe("clientIp", () => {
    it("defaults clientIp.enabled when missing", () => {
      expect(resolveOptions(baseConfig()).clientIp.enabled).toBe(
        DEFAULTS.clientIp.enabled,
      )
    })

    it("uses provided clientIp.enabled when set", () => {
      const resolved = resolveOptions(baseConfig({ clientIp: { enabled: false } }))

      expect(resolved.clientIp.enabled).toBe(false)
    })

    it("omits trustedProxies when not provided", () => {
      const resolved = resolveOptions(baseConfig({ clientIp: { enabled: true } }))

      expect(resolved.clientIp.trustedProxies).toBeUndefined()
      expect("trustedProxies" in resolved.clientIp).toBe(false)
    })

    it("floors trustedProxies to an integer", () => {
      const resolved = resolveOptions(
        baseConfig({ clientIp: { enabled: true, trustedProxies: 2.9 } }),
      )

      expect(resolved.clientIp.trustedProxies).toBe(2)
    })

    it("clamps trustedProxies to >= 0", () => {
      const resolved = resolveOptions(
        baseConfig({ clientIp: { enabled: true, trustedProxies: -5 } }),
      )

      expect(resolved.clientIp.trustedProxies).toBe(0)
    })
    it("omits trustedProxies when it is not a number at runtime", () => {
      const resolved = resolveOptions(
        baseConfig({ clientIp: { enabled: true, trustedProxies: "3" as any } }),
      )
      expect(resolved.clientIp.trustedProxies).toBeUndefined()
      expect("trustedProxies" in resolved.clientIp).toBe(false)
    })
  })

  describe("errorHandling passthrough", () => {
    it("passes through errorHandling (mappings)", () => {
      const errorHandling = { kind: "mappings", config: { mappings: {} } } as const
      const resolved = resolveOptions(baseConfig({ errorHandling }))

      expect(resolved.errorHandling).toBe(errorHandling)
    })

    it("passes through errorHandling (handler)", () => {
      const errorHandler = () =>
        ({
          status: 418,
          body: { error: { code: "x", status: 418, requestId: "req", message: "no" } },
        }) as any
      const errorHandling = { kind: "handler", errorHandler } as const

      const resolved = resolveOptions(baseConfig({ errorHandling }))

      expect(resolved.errorHandling).toBe(errorHandling)
    })
  })

  describe("routes passthrough", () => {
    it("passes through routes function", () => {
      const routes = vi.fn()
      const resolved = resolveOptions(baseConfig({ routes }))

      expect(resolved.routes).toBe(routes)
    })
  })

  describe("lifecycle hooks", () => {
    it("defaults beforeStart to [] when not provided", () => {
      const resolved = resolveOptions(baseConfig())

      expect(resolved.beforeStart).toEqual([])
    })

    it("defaults beforeStop to [] when not provided", () => {
      const resolved = resolveOptions(baseConfig())

      expect(resolved.beforeStop).toEqual([])
    })

    it("uses provided beforeStart when set", () => {
      const beforeStart = [{ name: "hook1", fn: vi.fn() }]
      const resolved = resolveOptions(baseConfig({ beforeStart }))

      expect(resolved.beforeStart).toBe(beforeStart)
    })

    it("uses provided beforeStop when set", () => {
      const beforeStop = [{ name: "hook1", fn: vi.fn() }]
      const resolved = resolveOptions(baseConfig({ beforeStop }))

      expect(resolved.beforeStop).toBe(beforeStop)
    })
  })

  describe("middleware", () => {
    it("defaults middleware.pre to [] when not provided", () => {
      const resolved = resolveOptions(baseConfig())

      expect(resolved.middleware.pre).toEqual([])
    })

    it("defaults middleware.post to [] when not provided", () => {
      const resolved = resolveOptions(baseConfig())

      expect(resolved.middleware.post).toEqual([])
    })

    it("uses provided middleware.pre when set", () => {
      const pre = [vi.fn(), vi.fn()]
      const resolved = resolveOptions(baseConfig({ middleware: { pre } }))

      expect(resolved.middleware.pre).toBe(pre)
    })

    it("uses provided middleware.post when set", () => {
      const post = [vi.fn()]
      const resolved = resolveOptions(baseConfig({ middleware: { post } }))

      expect(resolved.middleware.post).toBe(post)
    })

    it("defaults missing pre when only post provided", () => {
      const post = [vi.fn()]
      const resolved = resolveOptions(baseConfig({ middleware: { post } }))

      expect(resolved.middleware.pre).toEqual([])
      expect(resolved.middleware.post).toBe(post)
    })

    it("defaults missing post when only pre provided", () => {
      const pre = [vi.fn()]
      const resolved = resolveOptions(baseConfig({ middleware: { pre } }))

      expect(resolved.middleware.pre).toBe(pre)
      expect(resolved.middleware.post).toEqual([])
    })
  })
})
