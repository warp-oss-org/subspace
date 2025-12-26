import { NullLogger } from "../null-logger"

describe("NullLogger contract", () => {
  it("never throws for any method", () => {
    const logger = new NullLogger()

    expect(() => logger.trace("x")).not.toThrow()
    expect(() => logger.debug("x")).not.toThrow()
    expect(() => logger.info("x")).not.toThrow()
    expect(() => logger.warn("x")).not.toThrow()
    expect(() => logger.error("x")).not.toThrow()
    expect(() => logger.fatal("x")).not.toThrow()
  })

  it("child() returns a logger and remains a no-op", () => {
    const logger = new NullLogger()

    const child = logger.child({ requestId: "r-1" } as any)

    expect(child).toBeTruthy()
    expect(() => child.info("x")).not.toThrow()
  })
})
