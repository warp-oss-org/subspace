import { nanoid } from "../nanoid"

describe("nanoid (behavior)", () => {
  it("respects custom size", () => {
    const id = nanoid(10).generate()

    expect(id.length).toBe(10)
  })

  it("generates URL-safe characters", () => {
    const id = nanoid().generate()

    expect(id).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})
