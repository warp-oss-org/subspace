import type { Logger } from "@subspace/logger"
import type { MockProxy } from "vitest-mock-extended"
import { mock } from "vitest-mock-extended"
import type { ResolvedServerOptions } from "../../server/server-options"
import { createDefaultMiddleware } from "../create-default-middleware"

describe("createDefaultMiddleware (weak sanity checks)", () => {
  let logger: MockProxy<Logger>

  beforeEach(() => {
    logger = mock<Logger>()
  })

  function baseOptions(): ResolvedServerOptions {
    return {
      port: 3000,
      host: "0.0.0.0",
      startupTimeoutMs: 10_000,
      shutdownTimeoutMs: 10_000,

      requestId: { enabled: false },
      requestLogging: { enabled: false },
      clientIp: { enabled: false },
      health: { enabled: false },

      middleware: { pre: [], post: [] },
      routes: () => {},
      errorHandling: { kind: "mappings", config: { mappings: {} } },
    } as any as ResolvedServerOptions
  }

  it("returns base middleware when all optional features are disabled", () => {
    const middleware = createDefaultMiddleware(baseOptions(), logger)

    expect(middleware).toHaveLength(4)
  })

  it("adds requestId middleware when enabled", () => {
    const options = baseOptions()
    options.requestId = {
      enabled: true,
      header: "x-request-id",
      fallbackToTraceparent: false,
      generate: () => "req-1",
    }

    const middleware = createDefaultMiddleware(options, logger)

    expect(middleware).toHaveLength(5)
  })

  it("adds clientIp middleware when enabled", () => {
    const options = baseOptions()
    options.clientIp = { enabled: true, trustedProxies: 0 }

    const middleware = createDefaultMiddleware(options, logger)

    expect(middleware).toHaveLength(5)
  })

  it("adds requestLogging middleware when enabled", () => {
    const options = baseOptions()
    options.requestLogging = {
      enabled: true,
      level: "info",
      ignorePaths: [],
    }

    const middleware = createDefaultMiddleware(options, logger)

    expect(middleware).toHaveLength(5)
  })

  it("adds all optional middleware when all features are enabled", () => {
    const options = baseOptions()
    options.requestId = {
      enabled: true,
      header: "x-request-id",
      fallbackToTraceparent: false,
      generate: () => "req-1",
    }
    options.clientIp = { enabled: true, trustedProxies: 0 }
    options.requestLogging = {
      enabled: true,
      level: "info",
      ignorePaths: [],
    }

    const middleware = createDefaultMiddleware(options, logger)

    expect(middleware).toHaveLength(7)
  })
})
