import { constant } from "../constant"

describe("constant", () => {
  it("returns same delay regardless of attempt", () => {
    const policy = constant({ delay: { milliseconds: 100 } })

    expect(policy.getDelay(0)).toEqual({ milliseconds: 100 })
    expect(policy.getDelay(1)).toEqual({ milliseconds: 100 })
    expect(policy.getDelay(5)).toEqual({ milliseconds: 100 })
    expect(policy.getDelay(100)).toEqual({ milliseconds: 100 })
  })

  it("handles zero delay", () => {
    const policy = constant({ delay: { milliseconds: 0 } })

    expect(policy.getDelay(0)).toEqual({ milliseconds: 0 })
    expect(policy.getDelay(10)).toEqual({ milliseconds: 0 })
  })

  it("handles large delay", () => {
    const policy = constant({ delay: { milliseconds: 60000 } })

    expect(policy.getDelay(0)).toEqual({ milliseconds: 60000 })
  })
})
