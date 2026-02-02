import type { LogContext, LogContextPatch, LogMeta } from "../../ports/log-context"
import { type LogLevelName, LogLevels } from "../../ports/log-level"
import type { Logger } from "../../ports/logger"
import type { LoggerOptions } from "../../ports/logger-options"

export type ConsoleWriter = Pick<Console, "trace" | "debug" | "info" | "warn" | "error">

export type ConsoleLoggerDeps = {
  console?: ConsoleWriter
}

type ConsoleMethod = "trace" | "debug" | "info" | "warn" | "error"

const LEVEL_TO_CONSOLE_METHOD: Record<LogLevelName, ConsoleMethod> = {
  trace: "trace",
  debug: "debug",
  info: "info",
  warn: "warn",
  error: "error",
  fatal: "error",
}

const LEVEL_SEVERITY: Record<LogLevelName, number> = {
  trace: LogLevels.Trace,
  debug: LogLevels.Debug,
  info: LogLevels.Info,
  warn: LogLevels.Warn,
  error: LogLevels.Error,
  fatal: LogLevels.Fatal,
}

export class ConsoleLogger<TContext extends LogContext = LogContext>
  implements Logger<TContext>
{
  private readonly sink: ConsoleWriter
  private readonly opts: Partial<LoggerOptions>
  private readonly context: LogContextPatch

  constructor(
    private readonly deps: ConsoleLoggerDeps = {},
    opts: Partial<LoggerOptions> = {},
    context: LogContextPatch = {},
  ) {
    this.sink = deps.console ?? globalThis.console
    this.opts = opts
    this.context = stripUndefined(context)
  }

  child<U extends LogContextPatch>(context: U): Logger<TContext & U> {
    return new ConsoleLogger<TContext & U>(this.deps, this.opts, {
      ...this.context,
      ...stripUndefined(context),
    })
  }

  trace(message: string, meta?: LogMeta<TContext>): void {
    this.write("trace", message, meta)
  }

  debug(message: string, meta?: LogMeta<TContext>): void {
    this.write("debug", message, meta)
  }

  info(message: string, meta?: LogMeta<TContext>): void {
    this.write("info", message, meta)
  }

  warn(message: string, meta?: LogMeta<TContext>): void {
    this.write("warn", message, meta)
  }

  error(message: string, meta?: LogMeta<TContext>): void {
    this.write("error", message, meta)
  }

  fatal(message: string, meta?: LogMeta<TContext>): void {
    this.write("fatal", message, meta)
  }

  private shouldLog(level: LogLevelName): boolean {
    const min = this.opts.level ?? "info"
    return LEVEL_SEVERITY[level] >= LEVEL_SEVERITY[min]
  }

  private write(level: LogLevelName, message: string, meta?: LogMeta<TContext>) {
    if (!this.shouldLog(level)) return

    const safeMeta = meta ? stripUndefined(meta as Record<string, unknown>) : {}
    delete safeMeta.timestamp
    delete safeMeta.level
    delete safeMeta.message

    const payload: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...safeMeta,
    }

    if ("err" in payload) {
      payload.err = normalizeError(payload.err)
    }

    const output = this.opts.prettify ? formatPretty(payload) : safeStringify(payload)

    this.sink[LEVEL_TO_CONSOLE_METHOD[level]](output)
  }
}

function normalizeError(err: unknown): unknown {
  if (!(err instanceof Error)) return err

  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    cause: err.cause,
  }
}

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return JSON.stringify({ message: "Failed to stringify log payload" })
  }
}

function formatPretty(payload: Record<string, unknown>): string {
  const timestamp =
    typeof payload.timestamp === "string" ? payload.timestamp : new Date().toISOString()
  const level = typeof payload.level === "string" ? payload.level.toUpperCase() : "INFO"
  const message = typeof payload.message === "string" ? payload.message : ""

  const { timestamp: _, level: __, message: ___, err, ...rest } = payload

  const errorObj = err as Record<string, unknown> | undefined
  const stack = typeof errorObj?.stack === "string" ? errorObj.stack : undefined

  if (errorObj && stack) {
    const { stack: _, ...errWithoutStack } = errorObj
    rest.err = errWithoutStack
  } else if (err !== undefined) {
    rest.err = err
  }

  const tail = Object.keys(rest).length ? ` ${safeStringify(rest)}` : ""
  const line = `${timestamp} ${level} ${message}${tail}`

  if (!stack) return line

  const indentedStack = stack
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n")

  return `${line}\n${indentedStack}`
}

export function createConsoleLogger<TContext extends LogContext = LogContext>(
  deps: ConsoleLoggerDeps = {},
  opts: Partial<LoggerOptions> = {},
): Logger<TContext> {
  return new ConsoleLogger<TContext>(deps, opts)
}
