import { Writable } from "node:stream"
import type { CapturedLog, LoggerHarness } from "../../../ports/__tests__/logger-harness"
import type { LogLevelName } from "../../../ports/log-level"
import { PinoLogger } from "../pino-logger"

const pinoLevelToName: Record<number, LogLevelName> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
}

export function pinoHarness(): LoggerHarness {
  return {
    name: "PinoLogger",
    make: (opts) => {
      const captured: CapturedLog[] = []

      const destination = new Writable({
        write(chunk, _, cb) {
          const payload = JSON.parse(chunk.toString())
          const level = pinoLevelToName[Number(payload.level)] ?? "info"

          captured.push({ level, payload })

          cb()
        },
      })

      return {
        logger: new PinoLogger(
          { destination },
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
