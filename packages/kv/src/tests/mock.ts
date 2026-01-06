import type { MockedFunction } from "vitest"
import type { MockProxy as _MockProxy } from "vitest-mock-extended"

export type Mock<T> = _MockProxy<T> & T
export type MockFunction<T extends (...args: any[]) => any> = MockedFunction<T>
