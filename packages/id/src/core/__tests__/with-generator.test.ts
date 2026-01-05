import type { IdGenerator } from "../../ports/id-generator"
import type { Brand } from "../brand"
import { withGenerator } from "../id-codec"
import type { IdType } from "../id-type"

type TestId = Brand<string, "TestId">

const isTestId = (v: unknown): v is TestId =>
  typeof v === "string" && v.startsWith("test_")

const TestIdType: IdType<TestId> = {
  kind: "TestId",
  is: isTestId,
  parse: (v) => {
    if (!isTestId(v)) throw new Error("Invalid TestId")
    return v
  },
}

const testGenerator: IdGenerator<TestId> = {
  generate: () => "test_123" as TestId,
}

describe("withGenerator", () => {
  it("returns an IdCodec combining IdType and IdGenerator", () => {
    const codec = withGenerator(TestIdType, testGenerator)

    expect(codec.kind).toBe("TestId")
    expect(typeof codec.is).toBe("function")
    expect(typeof codec.parse).toBe("function")
    expect(typeof codec.generate).toBe("function")
  })

  it("preserves IdType.is behavior", () => {
    const codec = withGenerator(TestIdType, testGenerator)

    expect(codec.is("test_abc")).toBe(true)
    expect(codec.is("other_abc")).toBe(false)
    expect(codec.is(123)).toBe(false)
  })

  it("preserves IdType.parse behavior", () => {
    const codec = withGenerator(TestIdType, testGenerator)

    expect(codec.parse("test_abc")).toBe("test_abc")
    expect(() => codec.parse("invalid")).toThrow("Invalid TestId")
  })

  it("preserves IdGenerator.generate behavior", () => {
    const codec = withGenerator(TestIdType, testGenerator)

    expect(codec.generate()).toBe("test_123")
  })

  it("generated values pass validation", () => {
    const codec = withGenerator(TestIdType, testGenerator)
    const id = codec.generate()

    expect(codec.is(id)).toBe(true)
    expect(codec.parse(id)).toBe(id)
  })
})
