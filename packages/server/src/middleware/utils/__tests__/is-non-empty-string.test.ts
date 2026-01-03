import { isNonEmptyString } from "../is-non-empty-string"

describe("isNonEmptyString", () => {
  it("returns true for a non-empty string", () => {
    expect(isNonEmptyString("hello")).toBe(true)
  })

  it("returns true for a string with surrounding whitespace", () => {
    expect(isNonEmptyString("  hello  ")).toBe(true)
  })

  it("returns false for an empty string", () => {
    expect(isNonEmptyString("")).toBe(false)
  })

  it("returns false for a string with only whitespace", () => {
    expect(isNonEmptyString("   ")).toBe(false)
    expect(isNonEmptyString("\n\t")).toBe(false)
  })

  it("returns false for non-string values", () => {
    expect(isNonEmptyString(undefined)).toBe(false)
    expect(isNonEmptyString(null)).toBe(false)
    expect(isNonEmptyString(0)).toBe(false)
    expect(isNonEmptyString(false)).toBe(false)
    expect(isNonEmptyString({})).toBe(false)
    expect(isNonEmptyString([])).toBe(false)
  })

  it("narrows the type to string when true", () => {
    expect.hasAssertions()

    const value: unknown = "hello"

    if (isNonEmptyString(value)) {
      expect(value.toUpperCase()).toBe("HELLO")
    }
  })
})
