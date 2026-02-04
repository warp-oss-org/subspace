import type { MockProxy as _MockProxy } from "vitest-mock-extended"

export type Mock<T> = _MockProxy<T> & T
