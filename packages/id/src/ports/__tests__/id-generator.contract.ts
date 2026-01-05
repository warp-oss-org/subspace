import type { IdGenerator } from "../id-generator"

export function describeIdGeneratorContract(
  name: string,
  createGenerator: () => IdGenerator<string>,
) {
  describe(`IdGenerator contract: ${name}`, () => {
    let generator: IdGenerator<string>

    beforeEach(() => {
      generator = createGenerator()
    })

    it("generates a string", () => {
      const id = generator.generate()

      expect(typeof id).toBe("string")
    })

    it("generates non-empty strings", () => {
      const id = generator.generate()
      expect(id.length).toBeGreaterThan(0)
    })

    it("generates unique values", () => {
      const ids = new Set(Array.from({ length: 1000 }, () => generator.generate()))

      expect(ids.size).toBe(1000)
    })
  })
}
