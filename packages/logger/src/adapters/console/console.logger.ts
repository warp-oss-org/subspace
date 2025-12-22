import type { LogContext, LogMeta } from "../../ports/log-context"
import { type LogLevelName, LogLevels } from "../../ports/log-level"
import type { Logger } from "../../ports/logger"
import type { LoggerOptions } from "../../ports/logger-options"

type ConsoleMethod = "debug" | "info" | "warn" | "error"

type ConsoleLoggerContext = Partial<LogContext> & Record<string, unknown>

const LEVEL_TO_CONSOLE_METHOD: Record<LogLevelName, ConsoleMethod> = {
  trace: "debug",
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
  private readonly opts: Partial<LoggerOptions>
  private readonly context: ConsoleLoggerContext

  constructor(opts: Partial<LoggerOptions> = {}, context: ConsoleLoggerContext = {}) {
    this.opts = opts
    this.context = this.stripUndefined(context)
  }

  child<U extends Partial<LogContext> & Record<string, unknown>>(
    context: U,
  ): Logger<TContext & U> {
    return new ConsoleLogger<TContext & U>(this.opts, {
      ...this.context,
      ...this.stripUndefined(context),
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

  private normalizeErr(err: unknown): unknown {
    if (err === null) return err
    if (err instanceof Error) {
      return {
        name: err.name,
        message: err.message,
        stack: err.stack,
        cause: (err as { cause?: unknown }).cause,
      }
    }
    return err
  }

  private stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) out[k] = v
    }
    return out
  }

  private safeStringify(value: unknown): string {
    try {
      return JSON.stringify(value)
    } catch {
      return JSON.stringify({ message: "Failed to stringify log payload" })
    }
  }

  private prettyLine(payload: Record<string, unknown>): string {
    const timestamp =
      typeof payload.timestamp === "string" ? payload.timestamp : new Date().toISOString()
    const level = typeof payload.level === "string" ? payload.level.toUpperCase() : "INFO"
    const message = typeof payload.message === "string" ? payload.message : ""

    const { timestamp: _t, level: _l, message: _m, ...rest } = payload
    const tail = Object.keys(rest).length ? ` ${this.safeStringify(rest)}` : ""

    return `${timestamp} ${level} ${message}${tail}`
  }

  private write(level: LogLevelName, message: string, meta?: LogMeta<TContext>) {
    if (!this.shouldLog(level)) return

    const payload: Record<string, unknown> = this.stripUndefined({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...(meta ? this.stripUndefined(meta as unknown as Record<string, unknown>) : {}),
    })

    if ("err" in payload) {
      payload.err = this.normalizeErr(payload.err)
    }

    const output = this.opts.prettify
      ? this.prettyLine(payload)
      : this.safeStringify(payload)

    console[LEVEL_TO_CONSOLE_METHOD[level]](output)
  }
}
