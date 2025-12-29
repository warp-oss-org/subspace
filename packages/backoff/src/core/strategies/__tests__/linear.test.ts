import { linear } from "../linear"

describe("linear", () => {
  it("returns base delay on attempt 0", () => {
    const policy = linear({
      base: { milliseconds: 100 },
      increment: { milliseconds: 50 },
    })

    expect(policy.getDelay(0)).toEqual({ milliseconds: 100 })
  })

  it("adds increment on each attempt", () => {
    const policy = linear({
      base: { milliseconds: 100 },
      increment: { milliseconds: 50 },
    })

    expect(policy.getDelay(0)).toEqual({ milliseconds: 100 })
    expect(policy.getDelay(1)).toEqual({ milliseconds: 150 })
    expect(policy.getDelay(2)).toEqual({ milliseconds: 200 })
    expect(policy.getDelay(3)).toEqual({ milliseconds: 250 })
  })

  it("handles zero increment (constant)", () => {
    const policy = linear({
      base: { milliseconds: 100 },
      increment: { milliseconds: 0 },
    })

    expect(policy.getDelay(0)).toEqual({ milliseconds: 100 })
    expect(policy.getDelay(5)).toEqual({ milliseconds: 100 })
  })

  it("handles zero base", () => {
    const policy = linear({
      base: { milliseconds: 0 },
      increment: { milliseconds: 100 },
    })

    expect(policy.getDelay(0)).toEqual({ milliseconds: 0 })
    expect(policy.getDelay(1)).toEqual({ milliseconds: 100 })
    expect(policy.getDelay(2)).toEqual({ milliseconds: 200 })
  })

  it("handles large attempt numbers", () => {
    const policy = linear({
      base: { milliseconds: 100 },
      increment: { milliseconds: 50 },
    })

    expect(policy.getDelay(100)).toEqual({ milliseconds: 5100 })
  })
})
