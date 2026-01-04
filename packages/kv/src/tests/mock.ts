import type { MockedFunction } from "vitest"
import type { MockProxy as _MockProxy } from "vitest-mock-extended"

export type Mock<T> = _MockProxy<T> & T

// biome-ignore lint/suspicious/noExplicitAny: We need to allow any function signatures
export type MockFunction<T extends (...args: any[]) => any> = MockedFunction<T>
