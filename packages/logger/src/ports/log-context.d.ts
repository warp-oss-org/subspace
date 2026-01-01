export type LogContext = {
  requestId: string
  traceId: string
  spanId: string
  ip: string
  method: string
  path: string
  service: string
  module: string
  env: string
}
export type LogOutcome = {
  status: number
  durationMs: number
}
export type LogEvent = {
  err: unknown
}
export type LogMeta<TContext extends LogContext = LogContext> = Partial<TContext> &
  Partial<LogOutcome> &
  Partial<LogEvent> &
  Record<string, unknown>
/**
 * A partial overlay applied to an existing log context.
 * Used by child() to add or override context fields.
 */
export type LogContextPatch = Partial<LogContext> & Record<string, unknown>
//# sourceMappingURL=log-context.d.ts.map
