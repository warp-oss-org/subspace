import type { IdGenerator } from "../ports/id-generator"
import type { IdType } from "./id-type"

export type IdCodec<T> = IdType<T> & IdGenerator<T>

export const withGenerator = <T>(t: IdType<T>, g: IdGenerator<T>): IdCodec<T> => ({
  ...t,
  ...g,
})
