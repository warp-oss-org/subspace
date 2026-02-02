import { parseOrThrow, ValidationError } from "../validation"

function makeSchema<T>(impl: (data: unknown) => T): { parse: (data: unknown) => T } {
  return { parse: impl }
}

describe("parseOrThrow", () => {
  it("returns parsed value when schema.parse succeeds", () => {
    const schema = makeSchema((data) => {
      if (typeof data !== "string") throw new Error("boom")
      return data.toUpperCase()
    })

    const out = parseOrThrow(schema, "hi")

    expect(out).toBe("HI")
  })

  it("throws ValidationError when schema.parse throws a zod/mini-like error", () => {
    const schema = makeSchema((_data) => {
      throw {
        issues: [
          { path: ["user", "email"], message: "Invalid email" },
          { path: ["user", "age"], message: "Too young" },
        ],
      }
    })

    expect(() => parseOrThrow(schema, {})).toThrow(ValidationError)

    try {
      parseOrThrow(schema, {})
      throw new Error("unreachable")
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError)

      const e = err as ValidationError

      expect(e.code).toBe("validation_error")
      expect(e.message).toBe("Invalid email")

      expect(e.context).toEqual({
        issues: [
          { path: "user.email", message: "Invalid email" },
          { path: "user.age", message: "Too young" },
        ],
      })
    }
  })

  it("formats array indices as [n] in paths", () => {
    const schema = makeSchema((_data) => {
      throw {
        issues: [{ path: ["items", 0, "name"], message: "Required" }],
      }
    })

    try {
      parseOrThrow(schema, {})
      throw new Error("unreachable")
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError)

      const e = err as ValidationError

      expect(e.context).toEqual({
        issues: [{ path: "items[0].name", message: "Required" }],
      })
    }
  })

  it('uses "Invalid input" when issues are empty', () => {
    const schema = makeSchema((_data) => {
      throw { issues: [] }
    })

    try {
      parseOrThrow(schema, {})
      throw new Error("unreachable")
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError)

      const e = err as ValidationError

      expect(e.message).toBe("Invalid input")
      expect(e.context).toEqual({ issues: [] })
    }
  })

  it("rethrows non-zod errors unchanged", () => {
    const boom = new Error("nope")
    const schema = makeSchema((_data) => {
      throw boom
    })

    expect(() => parseOrThrow(schema, {})).toThrow(boom)
  })

  it("does not treat random objects as zod errors unless issues are well-formed", () => {
    const schema = makeSchema((_data) => {
      throw { issues: [{ path: "not-an-array", message: "Bad" }] }
    })

    expect(() => parseOrThrow(schema, {})).toThrow()
    try {
      parseOrThrow(schema, {})
      throw new Error("unreachable")
    } catch (err) {
      expect(err).not.toBeInstanceOf(ValidationError)
    }
  })
})
