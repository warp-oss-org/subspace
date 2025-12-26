import type { LogLevelName } from "../log-level"
import type { Logger } from "../logger"

export type CapturedLog = {
  level: LogLevelName
  payload: Record<string, unknown>
}

export type LoggerHarness = {
  name: string
  make: (opts?: { level?: LogLevelName }) => {
    logger: Logger
    read: () => CapturedLog[]
    clear: () => void
  }
}
