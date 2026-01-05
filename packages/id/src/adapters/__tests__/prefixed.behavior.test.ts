import { prefixed } from "../prefixed"
import { uuidV7 } from "../uuid"

describe("prefixed", () => {
  it("prepends prefix with underscore", () => {
    const generator = prefixed("usr", uuidV7)
    const id = generator.generate()

    expect(id.startsWith("usr_")).toBe(true)
  })

  it("includes inner generator output after prefix", () => {
    const generator = prefixed("ord", uuidV7)
    const id = generator.generate()
    const inner = id.slice(4)

    expect(inner).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })
})
