import type { LogLevelName } from "../../../ports/log-level"
import { ConsoleLogger } from "../console-logger"

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

  it("constructor defaults to global console when no override is provided", () => {
    const { lines, fakeConsole } = makeLineCaptureConsole()

    const originalConsole = globalThis.console

    try {
      globalThis.console = fakeConsole as any

      const logger = new ConsoleLogger(
        {},
        { level: "trace", prettify: false },
        { requestId: "r-1" },
      )

      logger.info("hello")

      expect(lines).toHaveLength(1)

      const payload = JSON.parse(lines[0]!)
      expect(payload).toMatchObject({
        level: "info",
        message: "hello",
        requestId: "r-1",
      })
    } finally {
      globalThis.console = originalConsole
    }
  })

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

  it("only emits log entries at or above the configured level", () => {
    const { lines, fakeConsole } = makeLineCaptureConsole()

    const logger = new ConsoleLogger(
      { console: fakeConsole },
      { level: "warn", prettify: false },
    )

    logger.info("ignored")
    logger.warn("included")
    logger.error("included-too")

    expect(lines).toHaveLength(2)

    const levels = lines.map((l) => JSON.parse(l).level)
    expect(levels).toEqual(["warn", "error"])
  })

  it("serializes Error values into a structured, JSON-safe form", () => {
    const { lines, fakeConsole } = makeLineCaptureConsole()

    const logger = new ConsoleLogger(
      { console: fakeConsole },
      { level: "trace", prettify: false },
    )

    const cause = new Error("root")
    const err = new Error("boom", { cause })

    logger.error("failed", { err })
    logger.error("failed-again", { err: { code: "E_CUSTOM" } } as any)

    const first = JSON.parse(lines[0]!)
    const second = JSON.parse(lines[1]!)

    expect(first.err).toMatchObject({
      name: "Error",
      message: "boom",
    })
    expect(first.err.cause).toBeDefined()
    expect(typeof first.err.cause).toBe("object")

    expect(second.err).toEqual({ code: "E_CUSTOM" })
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

  it("does not throw when log metadata cannot be serialized", () => {
    const { lines, fakeConsole } = makeLineCaptureConsole()

    const logger = new ConsoleLogger(
      { console: fakeConsole },
      { level: "trace", prettify: false },
    )

    const circular: any = { a: 1 }
    circular.self = circular

    logger.info("circular", { circular } as any)

    const payload = JSON.parse(lines[0]!)

    expect(lines).toHaveLength(1)
    expect(payload).toMatchObject({ message: "Failed to stringify log payload" })
  })

  it("preserves null error values without modification", () => {
    const { lines, fakeConsole } = makeLineCaptureConsole()

    const logger = new ConsoleLogger(
      { console: fakeConsole },
      { level: "trace", prettify: false },
    )

    logger.error("null-error", { err: null })

    const payload = JSON.parse(lines[0]!)

    expect(lines).toHaveLength(1)
    expect(payload.err).toBeNull()
  })

  it("emits trace and debug entries with the expected levels", () => {
    const { lines, fakeConsole } = makeLineCaptureConsole()

    const logger = new ConsoleLogger(
      { console: fakeConsole },
      { level: "trace", prettify: false },
    )

    logger.trace("t")
    logger.debug("d")

    const first = JSON.parse(lines[0]!)
    const second = JSON.parse(lines[1]!)

    expect(lines).toHaveLength(2)

    expect(first.level).toBe("trace")
    expect(first.message).toBe("t")

    expect(second.level).toBe("debug")
    expect(second.message).toBe("d")
  })

  it("defaults to info level when no minimum level is configured", () => {
    const { lines, fakeConsole } = makeLineCaptureConsole()

    const logger = new ConsoleLogger({ console: fakeConsole }, { prettify: false })

    logger.debug("ignored")
    logger.info("included")

    const payload = JSON.parse(lines[0]!)

    expect(lines).toHaveLength(1)
    expect(payload.level).toBe("info")
    expect(payload.message).toBe("included")
  })

  it("prettified output ignores metadata fields that collide with reserved keys", () => {
    const { lines, fakeConsole } = makeLineCaptureConsole()

    const logger = new ConsoleLogger(
      { console: fakeConsole },
      { level: "trace", prettify: true },
    )

    logger.info("test-message", {
      timestamp: 123,
      level: 456,
      message: "SHOULD_NOT_APPEAR",
    } as any)

    const line = lines[0]!

    expect(lines).toHaveLength(1)
    expect(line).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    expect(line).toContain("INFO")
    expect(line).not.toContain("456")
    expect(line).toContain("test-message")
    expect(line).not.toContain("SHOULD_NOT_APPEAR")
  })

  it("drops undefined metadata fields", () => {
    const { lines, fakeConsole } = makeLineCaptureConsole()

    const logger = new ConsoleLogger(
      { console: fakeConsole },
      { level: "trace", prettify: false },
    )

    logger.info("hello", { a: undefined, b: 1 } as any)

    const payload = JSON.parse(lines[0]!)

    expect(lines).toHaveLength(1)
    expect(payload).toMatchObject({
      level: "info",
      message: "hello",
      b: 1,
    })

    expect(Object.hasOwn(payload, "a")).toBe(false)
  })

  it("pretty output defaults message to empty string for non-string message and includes tail when rest is non-empty", () => {
    const { lines, fakeConsole } = makeLineCaptureConsole()

    const logger = new ConsoleLogger(
      { console: fakeConsole },
      { level: "trace", prettify: true },
    )

    logger.info(123 as any, { userId: "u-1" } as any)

    const line = lines[0]!

    expect(lines).toHaveLength(1)
    expect(line).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    expect(line).toContain("INFO")
    expect(line).toContain("userId")
    expect(line).toContain("u-1")
  })
})
