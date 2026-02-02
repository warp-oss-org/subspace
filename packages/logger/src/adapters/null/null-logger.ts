import type { LogContext, LogMeta } from "../../ports/log-context"
import type { Logger } from "../../ports/logger"

export class NullLogger<TContext extends LogContext = LogContext>
  implements Logger<TContext>
{
  trace(_message: string, _meta?: LogMeta<TContext>): void {}

  debug(_message: string, _meta?: LogMeta<TContext>): void {}

  info(_message: string, _meta?: LogMeta<TContext>): void {}

  warn(_message: string, _meta?: LogMeta<TContext>): void {}

  error(_message: string, _meta?: LogMeta<TContext>): void {}

  fatal(_message: string, _meta?: LogMeta<TContext>): void {}

  child<U extends Partial<LogContext> & Record<string, unknown>>(
    _context: U,
  ): Logger<TContext & U> {
    return new NullLogger<TContext & U>()
  }
}

export function createNullLogger<
  TContext extends LogContext = LogContext,
>(): Logger<TContext> {
  return new NullLogger<TContext>()
}
