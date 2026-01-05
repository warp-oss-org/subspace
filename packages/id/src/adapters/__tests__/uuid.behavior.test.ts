import { uuidV4, uuidV7 } from "../uuid"

describe("uuidV4 (behavior)", () => {
  it("generates valid v4 format", () => {
    const id = uuidV4.generate()

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })
})

describe("uuidV7 (behavior)", () => {
  it("generates valid v7 format", () => {
    const id = uuidV7.generate()

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it("generates sortable IDs (later > earlier)", () => {
    const first = uuidV7.generate()
    const second = uuidV7.generate()

    expect(second > first).toBe(true)
  })
})
