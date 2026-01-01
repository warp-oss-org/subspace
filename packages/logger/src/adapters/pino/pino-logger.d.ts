import { type DestinationStream, type Logger as PinoLoggerBase } from "pino"
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
export declare class PinoLogger<TContext extends LogContext = LogContext>
  implements Logger<TContext>
{
  protected readonly logger: PinoLoggerBase
  protected readonly opts: Partial<LoggerOptions>
  protected readonly deps: Readonly<PinoLoggerDeps>
  constructor(
    deps?: PinoLoggerDeps,
    opts?: Partial<LoggerOptions>,
    context?: LogContextPatch,
  )
  private init
  private toPinoMeta
  trace(message: string, meta?: LogMeta<TContext>): void
  debug(message: string, meta?: LogMeta<TContext>): void
  info(message: string, meta?: LogMeta<TContext>): void
  warn(message: string, meta?: LogMeta<TContext>): void
  error(message: string, meta?: LogMeta<TContext>): void
  fatal(message: string, meta?: LogMeta<TContext>): void
  child<U extends LogContextPatch>(context: U): Logger<TContext & U>
}
export declare function createPinoLogger<TContext extends LogContext = LogContext>(
  deps?: PinoLoggerDeps,
  opts?: Partial<LoggerOptions>,
  context?: LogContextPatch,
): Logger<TContext>
//# sourceMappingURL=pino-logger.d.ts.map
