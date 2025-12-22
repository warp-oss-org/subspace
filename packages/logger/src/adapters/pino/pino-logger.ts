import pino, {
  type Logger as PinoLoggerBase,
  type LoggerOptions as PinoOptions,
} from "pino"
import { errWithCause } from "pino-std-serializers"
import type { LogContext, LogMeta } from "../../ports/log-context"
import type { Logger } from "../../ports/logger"
import type { LoggerOptions } from "../../ports/logger-options"

export class PinoLogger<TContext extends LogContext = LogContext>
  implements Logger<TContext>
{
  protected readonly logger: PinoLoggerBase
  protected readonly opts: Partial<LoggerOptions>

  constructor(
    opts: Partial<LoggerOptions> = {},
    bindings: Partial<LogContext> & Record<string, unknown> = {},
    base?: PinoLoggerBase,
  ) {
    this.opts = opts
    this.logger = this.init(bindings, base)
  }

  private init(
    bindings: Partial<LogContext> & Record<string, unknown>,
    base?: PinoLoggerBase,
  ): PinoLoggerBase {
    if (base) return base.child(bindings)

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

    return pino(pinoOpts).child(bindings)
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

  child<U extends Partial<LogContext> & Record<string, unknown>>(
    context: U,
  ): Logger<TContext & U> {
    return new PinoLogger<TContext & U>(this.opts, context, this.logger)
  }
}
