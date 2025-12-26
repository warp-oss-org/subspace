import type { CapturedLog, LoggerHarness } from "../../../ports/__tests__/logger-harness"
import type { LogLevelName } from "../../../ports/log-level"
import { ConsoleLogger } from "../console.logger"

export function consoleHarness(): LoggerHarness {
  return {
    name: "ConsoleLogger",
    make: (opts) => {
      const captured: CapturedLog[] = []

      const capture = (line: string) => {
        const payload = JSON.parse(line)
        captured.push({ level: payload.level as LogLevelName, payload })
      }

      const fakeConsole = {
        trace: capture,
        debug: capture,
        info: capture,
        warn: capture,
        error: capture,
      }

      return {
        logger: new ConsoleLogger(
          { console: fakeConsole },
          { level: opts?.level ?? "trace", prettify: false },
          {},
        ),
        read: () => [...captured],
        clear: () => {
          captured.length = 0
        },
      }
    },
  }
}
