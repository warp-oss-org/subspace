import type { IdGenerator } from "../ports/id-generator"

export const prefixed = <T extends string>(
  prefix: string,
  inner: IdGenerator<string>,
): IdGenerator<T> => ({
  generate: () => `${prefix}_${inner.generate()}` as T,
})
