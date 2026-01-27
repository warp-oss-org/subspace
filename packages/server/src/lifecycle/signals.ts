import type { Logger } from "@subspace/logger"
import type { StopResult } from "./shutdown"

export interface SignalHandlerContext {
  logger: Logger
  stop?: () => Promise<StopResult>
  /** @default 10_000 */
  fatalTimeoutMs?: number
}

export interface SignalHandler {
  unregister: () => void
}

interface State {
  stopping: boolean
}

interface StateAccessor {
  get: () => State
  set: (updates: Partial<State>) => void
}

function handleSignal(
  ctx: SignalHandlerContext,
  state: StateAccessor,
  signal: NodeJS.Signals,
): void {
  ctx.logger.info("Received signal", { signal })

  if (state.get().stopping) return
  state.set({ stopping: true })

  void gracefulShutdown(ctx, signal)
}

function handleFatal(
  ctx: SignalHandlerContext,
  state: StateAccessor,
  fatalTimeoutMs: number,
  reason: string,
  err: unknown,
): void {
  if (state.get().stopping) {
    ctx.logger.fatal("Fatal error during shutdown", { reason, err })

    process.exit(1)
  }

  state.set({ stopping: true })

  void fatalShutdown(ctx, fatalTimeoutMs, reason, err)
}

async function gracefulShutdown(
  ctx: SignalHandlerContext,
  reason: string,
): Promise<void> {
  ctx.logger.warn("Shutdown triggered", { reason })

  await runStop(ctx, reason)
}

async function fatalShutdown(
  ctx: SignalHandlerContext,
  fatalTimeoutMs: number,
  reason: string,
  err: unknown,
): Promise<void> {
  ctx.logger.fatal("Fatal error", { reason, err })

  await withForceExit(ctx.logger, fatalTimeoutMs, () => runStop(ctx, reason))

  process.exit(1)
}

async function runStop(ctx: SignalHandlerContext, reason: string): Promise<void> {
  if (!ctx.stop) {
    ctx.logger.warn("No stop handler registered", { reason })
    return
  }

  try {
    const result = await ctx.stop()

    if (!result.ok) {
      ctx.logger.error("Shutdown completed with issues", {
        reason,
        failureCount: result.failures.length,
        timedOut: result.timedOut,
      })
    }
  } catch (err) {
    ctx.logger.error("Shutdown failed", { reason, err })
  }
}

async function withForceExit(
  logger: Logger,
  ms: number,
  fn: () => Promise<void>,
): Promise<void> {
  const timer = setTimeout(() => {
    logger.fatal("Forced exit after timeout", { timeoutMs: ms })

    process.exit(1)
  }, ms)

  timer.unref()

  try {
    await fn()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Registers process signal handlers for graceful shutdown.
 */
export function setupProcessHandlers(ctx: SignalHandlerContext): SignalHandler {
  const fatalTimeoutMs = ctx.fatalTimeoutMs ?? 10_000

  let state: State = { stopping: false }

  const stateAccessor: StateAccessor = {
    get: () => state,
    set: (updates) => {
      state = { ...state, ...updates }
    },
  }

  const sigintHandler = () => handleSignal(ctx, stateAccessor, "SIGINT")
  const sigtermHandler = () => handleSignal(ctx, stateAccessor, "SIGTERM")
  const uncaughtHandler = (err: Error) =>
    handleFatal(ctx, stateAccessor, fatalTimeoutMs, "uncaughtException", err)
  const rejectionHandler = (reason: unknown) =>
    handleFatal(ctx, stateAccessor, fatalTimeoutMs, "unhandledRejection", reason)

  process.on("SIGINT", sigintHandler)
  process.on("SIGTERM", sigtermHandler)
  process.on("uncaughtException", uncaughtHandler)
  process.on("unhandledRejection", rejectionHandler)

  return {
    unregister: () => {
      process.off("SIGINT", sigintHandler)
      process.off("SIGTERM", sigtermHandler)
      process.off("uncaughtException", uncaughtHandler)
      process.off("unhandledRejection", rejectionHandler)
    },
  }
}

export type SetupProcessHandlersFn = typeof setupProcessHandlers
