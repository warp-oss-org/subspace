import pino, {
  type DestinationStream,
  type Logger as PinoLoggerBase,
  type LoggerOptions as PinoOptions,
} from "pino"
import { errWithCause } from "pino-std-serializers"
import type { LogContext, LogContextPatch, LogMeta } from "../../ports/log-context"
import type { Logger } from "../../ports/logger"
import type { LoggerOptions } from "../../ports/logger-options"

export type PinoLoggerDeps = {
  /**
   * Base pino logger to create children from (inherits config).
   * When provided, this adapter will only add `bindings` via `.child(...)`.
   */
  base?: PinoLoggerBase

  /**
   * Optional destination stream for pino output.
   */
  destination?: DestinationStream
}

export class PinoLogger<TContext extends LogContext = LogContext>
  implements Logger<TContext>
{
  protected readonly logger: PinoLoggerBase
  protected readonly opts: Partial<LoggerOptions>
  protected readonly deps: Readonly<PinoLoggerDeps>

  constructor(
    deps: PinoLoggerDeps = {},
    opts: Partial<LoggerOptions> = {},
    context: LogContextPatch = {},
  ) {
    this.opts = opts
    this.deps = deps
    this.logger = this.init(context)
  }

  private init(context: LogContextPatch): PinoLoggerBase {
    if (this.deps.base) return this.deps.base.child(context)

    const pinoOpts: PinoOptions = {
      ...(this.opts.level && { level: this.opts.level }),
      serializers: { err: errWithCause },
      ...(this.opts.prettify && {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "hostname",
          },
        },
      }),
    }

    const root = this.deps.destination
      ? pino(pinoOpts, this.deps.destination)
      : pino(pinoOpts)

    return root.child(context)
  }

  private toPinoMeta(meta?: LogMeta<TContext>) {
    return meta as unknown as Parameters<PinoLoggerBase["info"]>[0]
  }

  trace(message: string, meta?: LogMeta<TContext>): void {
    this.logger.trace(this.toPinoMeta(meta), message)
  }

  debug(message: string, meta?: LogMeta<TContext>): void {
    this.logger.debug(this.toPinoMeta(meta), message)
  }

  info(message: string, meta?: LogMeta<TContext>): void {
    this.logger.info(this.toPinoMeta(meta), message)
  }

  warn(message: string, meta?: LogMeta<TContext>): void {
    this.logger.warn(this.toPinoMeta(meta), message)
  }

  error(message: string, meta?: LogMeta<TContext>): void {
    this.logger.error(this.toPinoMeta(meta), message)
  }

  fatal(message: string, meta?: LogMeta<TContext>): void {
    this.logger.fatal(this.toPinoMeta(meta), message)
  }

  child<U extends LogContextPatch>(context: U): Logger<TContext & U> {
    return new PinoLogger<TContext & U>({ base: this.logger }, this.opts, context)
  }
}

export function createPinoLogger<TContext extends LogContext = LogContext>(
  deps: PinoLoggerDeps = {},
  opts: Partial<LoggerOptions> = {},
  context: LogContextPatch = {},
): Logger<TContext> {
  return new PinoLogger<TContext>(deps, opts, context)
}
