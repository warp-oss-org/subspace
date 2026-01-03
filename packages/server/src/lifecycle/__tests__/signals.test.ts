import type { Logger } from "@subspace/logger"
import { mock } from "vitest-mock-extended"
import type { Mock } from "../../tests/mock"
import type { StopResult } from "../shutdown"
import { type SignalHandlerContext, setupProcessHandlers } from "../signals"

describe("setupProcessHandlers", () => {
  let logger: Mock<Logger>
  let processOnSpy: ReturnType<typeof vi.spyOn>
  let processOffSpy: ReturnType<typeof vi.spyOn>
  let processExitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logger = mock<Logger>()
    processOnSpy = vi.spyOn(process, "on").mockImplementation(() => process)
    processOffSpy = vi.spyOn(process, "off").mockImplementation(() => process)
    processExitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function baseCtx(overrides?: Partial<SignalHandlerContext>): SignalHandlerContext {
    return {
      logger,
      ...overrides,
    }
  }

  function successfulStop(): Promise<StopResult> {
    return Promise.resolve({ ok: true, failures: [], timedOut: false })
  }

  function failedStop(): Promise<StopResult> {
    return Promise.resolve({
      ok: false,
      failures: [{ hook: "test", error: new Error("fail") }],
      timedOut: false,
    })
  }

  function getHandler(event: string): ((...args: unknown[]) => void) | undefined {
    const call = processOnSpy.mock.calls.find(([e]: any[]) => e === event)
    return call?.[1] as ((...args: unknown[]) => void) | undefined
  }

  function emit(event: string, ...args: unknown[]): void {
    getHandler(event)?.(...args)
  }

  function neverResolvingStop() {
    return vi.fn(() => new Promise<StopResult>(() => {}))
  }

  describe("registration", () => {
    it("registers process handlers", () => {
      setupProcessHandlers(baseCtx())

      expect(processOnSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function))
      expect(processOnSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function))
      expect(processOnSpy).toHaveBeenCalledWith("uncaughtException", expect.any(Function))
      expect(processOnSpy).toHaveBeenCalledWith(
        "unhandledRejection",
        expect.any(Function),
      )
    })

    it("unregister removes handlers it installed", () => {
      const { unregister } = setupProcessHandlers(baseCtx())

      unregister()

      expect(processOffSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function))
      expect(processOffSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function))
      expect(processOffSpy).toHaveBeenCalledWith(
        "uncaughtException",
        expect.any(Function),
      )
      expect(processOffSpy).toHaveBeenCalledWith(
        "unhandledRejection",
        expect.any(Function),
      )
    })

    it("uses the default fatal timeout when not provided", async () => {
      vi.useFakeTimers()

      setupProcessHandlers(baseCtx({ stop: neverResolvingStop() }))

      emit("uncaughtException", new Error("test"))

      await vi.advanceTimersByTimeAsync(9_999)
      expect(processExitSpy).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      expect(processExitSpy).toHaveBeenCalledWith(1)

      vi.useRealTimers()
    })

    it("uses the provided fatal timeout when set", async () => {
      vi.useFakeTimers()

      const stop = neverResolvingStop()
      setupProcessHandlers(baseCtx({ stop, fatalTimeoutMs: 5_000 }))

      emit("uncaughtException", new Error("test"))

      await vi.advanceTimersByTimeAsync(4_999)
      expect(processExitSpy).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      expect(processExitSpy).toHaveBeenCalledWith(1)

      vi.useRealTimers()
    })
  })

  describe("graceful signals", () => {
    it("triggers shutdown on SIGINT", async () => {
      const stop = vi.fn(successfulStop)
      setupProcessHandlers(baseCtx({ stop }))

      emit("SIGINT")

      await vi.waitFor(() => expect(stop).toHaveBeenCalled())
    })

    it("triggers shutdown on SIGTERM", async () => {
      const stop = vi.fn(successfulStop)
      setupProcessHandlers(baseCtx({ stop }))

      emit("SIGTERM")

      await vi.waitFor(() => expect(stop).toHaveBeenCalled())
    })

    it("ignores subsequent signals while stopping", async () => {
      const stop = vi.fn(successfulStop)
      setupProcessHandlers(baseCtx({ stop }))

      emit("SIGINT")
      emit("SIGINT")
      emit("SIGINT")

      await vi.waitFor(() => expect(stop).toHaveBeenCalledOnce())
    })

    it("does not call process.exit for SIGINT/SIGTERM", async () => {
      const stop = vi.fn(successfulStop)

      setupProcessHandlers(baseCtx({ stop }))

      emit("SIGINT")

      await vi.waitFor(() => expect(stop).toHaveBeenCalled())
      expect(processExitSpy).not.toHaveBeenCalled()
    })

    it("logs shutdown reason for SIGINT/SIGTERM", async () => {
      const stop = vi.fn(successfulStop)
      setupProcessHandlers(baseCtx({ stop }))

      emit("SIGTERM")

      await vi.waitFor(() => expect(stop).toHaveBeenCalled())

      expect(logger.info).toHaveBeenCalledWith("Received signal", { signal: "SIGTERM" })
      expect(logger.warn).toHaveBeenCalledWith("Shutdown triggered", {
        reason: "SIGTERM",
      })
    })
  })

  describe("fatal events", () => {
    it("triggers fatal shutdown on uncaughtException", async () => {
      const stop = vi.fn(successfulStop)
      setupProcessHandlers(baseCtx({ stop }))

      emit("uncaughtException", new Error("boom"))

      await vi.waitFor(() => expect(stop).toHaveBeenCalled())
    })

    it("triggers fatal shutdown on unhandledRejection", async () => {
      const stop = vi.fn(successfulStop)
      setupProcessHandlers(baseCtx({ stop }))

      emit("unhandledRejection", new Error("rejected"))

      await vi.waitFor(() => expect(stop).toHaveBeenCalled())
    })

    it("exits non-zero for fatal events", async () => {
      const stop = vi.fn(successfulStop)
      setupProcessHandlers(baseCtx({ stop }))

      emit("uncaughtException", new Error("boom"))

      await vi.waitFor(() => expect(processExitSpy).toHaveBeenCalledWith(1))
    })

    it("exits immediately if a fatal occurs while already stopping", async () => {
      const stop = neverResolvingStop()
      setupProcessHandlers(baseCtx({ stop }))

      emit("SIGINT")
      emit("uncaughtException", new Error("boom"))

      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it("logs fatal reason + error payload", async () => {
      const stop = vi.fn(successfulStop)
      setupProcessHandlers(baseCtx({ stop }))

      const error = new Error("boom")
      emit("uncaughtException", error)

      await vi.waitFor(() => expect(stop).toHaveBeenCalled())

      expect(logger.fatal).toHaveBeenCalledWith("Fatal error", {
        reason: "uncaughtException",
        err: error,
      })
    })
  })

  describe("stop integration", () => {
    it("logs when no stop handler is registered", async () => {
      setupProcessHandlers(baseCtx({ stop: undefined } as any))

      emit("SIGINT")

      await vi.waitFor(() => {
        expect(logger.warn).toHaveBeenCalledWith("No stop handler registered", {
          reason: "SIGINT",
        })
      })
    })

    it("does not log issues when stop succeeds cleanly", async () => {
      const stop = vi.fn(successfulStop)
      setupProcessHandlers(baseCtx({ stop }))

      emit("SIGINT")

      await vi.waitFor(() => expect(stop).toHaveBeenCalled())

      expect(logger.error).not.toHaveBeenCalled()
    })

    it("logs shutdown issues when stop reports failures or timeout", async () => {
      const stop = vi.fn(failedStop)
      setupProcessHandlers(baseCtx({ stop }))

      emit("SIGINT")

      await vi.waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith("Shutdown completed with issues", {
          reason: "SIGINT",
          failureCount: 1,
          timedOut: false,
        })
      })
    })

    it("logs when stop throws", async () => {
      const error = new Error("stop exploded")
      const stop = vi.fn(() => Promise.reject(error))

      setupProcessHandlers(baseCtx({ stop }))

      emit("SIGINT")

      await vi.waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith("Shutdown failed", {
          reason: "SIGINT",
          err: error,
        })
      })
    })
  })

  describe("force-exit timeout", () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("forces exit if shutdown does not complete before the fatal timeout", async () => {
      const stop = neverResolvingStop()
      setupProcessHandlers(baseCtx({ stop, fatalTimeoutMs: 5_000 }))

      emit("uncaughtException", new Error("boom"))

      await vi.advanceTimersByTimeAsync(5_000)

      expect(processExitSpy).toHaveBeenCalledWith(1)
      expect(logger.fatal).toHaveBeenCalledWith("Forced exit after timeout", {
        timeoutMs: 5_000,
      })
    })

    it("does not force exit if shutdown completes before the fatal timeout", async () => {
      const stop = vi.fn(successfulStop)
      setupProcessHandlers(baseCtx({ stop, fatalTimeoutMs: 5_000 }))

      emit("uncaughtException", new Error("boom"))

      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(10_000)

      expect(processExitSpy).toHaveBeenCalledTimes(1)
    })
  })
})
