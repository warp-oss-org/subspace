import type { LogLevelName } from "../../../ports/log-level"
import { ConsoleLogger } from "../console.logger"

describe("ConsoleLogger behavior", () => {
  function makeLineCaptureConsole(opts?: { recordMethod?: boolean }) {
    const lines: string[] = []
    const calls: { method: LogLevelName; line: string }[] = []

    const capture = (method: LogLevelName) => (line: unknown) => {
      const text = String(line)

      lines.push(text)

      if (opts?.recordMethod) {
        calls.push({ method, line: text })
      }
    }

    const fakeConsole = {
      trace: capture("trace"),
      debug: capture("debug"),
      info: capture("info"),
      warn: capture("warn"),
      error: capture("error"),
    }

    return { lines, calls, fakeConsole }
  }

  it("emits parseable JSON when prettify is false", () => {
    const { lines, fakeConsole } = makeLineCaptureConsole()

    const logger = new ConsoleLogger(
      { console: fakeConsole },
      { level: "trace", prettify: false },
      { requestId: "r-1" },
    )

    logger.info("hello", { userId: "u-1" } as any)

    expect(lines).toHaveLength(1)

    const payload = JSON.parse(lines[0]!)

    expect(payload).toMatchObject({
      level: "info",
      message: "hello",
      requestId: "r-1",
      userId: "u-1",
    })
    expect(typeof payload.timestamp).toBe("string")
  })

  it("prettify true emits a human-readable line", () => {
    const { lines, fakeConsole } = makeLineCaptureConsole()

    const logger = new ConsoleLogger(
      { console: fakeConsole },
      { level: "trace", prettify: true },
      { requestId: "r-1" },
    )

    logger.warn("hello")

    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain("WARN")
    expect(lines[0]).toContain("hello")
  })

  it("uses the correct console method for a level (fatal -> error)", () => {
    const { calls, fakeConsole } = makeLineCaptureConsole({ recordMethod: true })

    const logger = new ConsoleLogger(
      { console: fakeConsole },
      { level: "trace", prettify: false },
    )

    logger.fatal("boom")

    expect(calls).toHaveLength(1)
    expect(calls[0]?.method).toBe("error")
  })
})
