export type LogContext = {
  requestId: string
  traceId: string
  spanId: string

  ip: string
  method: string
  path: string

  status: number
  durationMs: number

  service: string
  module: string
  env: string
}

export type LogEvent = {
  err: unknown
}

export type LogMeta<TContext extends LogContext = LogContext> = Partial<TContext> &
  Partial<LogEvent>
