import { exponential } from "../exponential"

describe("exponential", () => {
  it("returns base delay on attempt 0", () => {
    const policy = exponential({ base: { milliseconds: 100 } })

    expect(policy.getDelay(0)).toEqual({ milliseconds: 100 })
  })

  it("doubles delay by default on each attempt", () => {
    const policy = exponential({ base: { milliseconds: 100 } })

    expect(policy.getDelay(0)).toEqual({ milliseconds: 100 })
    expect(policy.getDelay(1)).toEqual({ milliseconds: 200 })
    expect(policy.getDelay(2)).toEqual({ milliseconds: 400 })
    expect(policy.getDelay(3)).toEqual({ milliseconds: 800 })
  })

  it("uses custom factor", () => {
    const policy = exponential({ base: { milliseconds: 100 }, factor: 3 })

    expect(policy.getDelay(0)).toEqual({ milliseconds: 100 })
    expect(policy.getDelay(1)).toEqual({ milliseconds: 300 })
    expect(policy.getDelay(2)).toEqual({ milliseconds: 900 })
  })

  it("handles factor of 1 (constant)", () => {
    const policy = exponential({ base: { milliseconds: 100 }, factor: 1 })

    expect(policy.getDelay(0)).toEqual({ milliseconds: 100 })
    expect(policy.getDelay(1)).toEqual({ milliseconds: 100 })
    expect(policy.getDelay(5)).toEqual({ milliseconds: 100 })
  })

  it("handles fractional factor", () => {
    const policy = exponential({ base: { milliseconds: 100 }, factor: 1.5 })

    expect(policy.getDelay(0)).toEqual({ milliseconds: 100 })
    expect(policy.getDelay(1)).toEqual({ milliseconds: 150 })
    expect(policy.getDelay(2)).toEqual({ milliseconds: 225 })
  })

  it("handles large attempt numbers", () => {
    const policy = exponential({ base: { milliseconds: 100 } })

    expect(policy.getDelay(10)).toEqual({ milliseconds: 102400 })
  })
})
