import { Writable } from "node:stream"
import { describe, expect, it } from "vitest"

import { PinoLogger } from "../pino-logger"

function makeLineDestination() {
  const lines: string[] = []

  const destination = new Writable({
    write(chunk, _encoding, callback) {
      const line = chunk.toString("utf8").trim()
      if (line) lines.push(line)
      callback()
    },
  })

  return { lines, destination }
}

describe("PinoLogger behavior", () => {
  it("emits JSON to the provided destination (no base)", () => {
    const { lines, destination } = makeLineDestination()

    const logger = new PinoLogger(
      { destination },
      { level: "trace", prettify: false },
      { requestId: "r-1" },
    )

    logger.info("hello", { userId: "u-1" } as any)

    expect(lines).toHaveLength(1)

    const payload = JSON.parse(lines[0]!)

    expect(payload).toMatchObject({
      msg: "hello",
      requestId: "r-1",
      userId: "u-1",
    })

    expect(typeof payload.time).toBe("number")
    expect(typeof payload.level).toBe("number")
  })

  it("child() inherits the base logger sink and config", () => {
    const { lines, destination } = makeLineDestination()

    const base = new PinoLogger(
      { destination },
      { level: "warn", prettify: false },
      { requestId: "r-1" },
    )
    const child = base.child({ userId: "u-1" } as any)

    child.info("ignored")
    child.warn("logged")

    expect(lines).toHaveLength(1)

    const payload = JSON.parse(lines[0]!)

    expect(payload).toMatchObject({
      msg: "logged",
      requestId: "r-1",
      userId: "u-1",
    })
  })
})
