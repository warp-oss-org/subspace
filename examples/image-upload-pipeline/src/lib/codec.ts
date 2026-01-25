import type { Codec } from "@subspace/kv"
import superjson from "superjson"

export function createJsonCodec<T>(): Codec<T> {
  return {
    encode: (value: T) => Buffer.from(superjson.stringify(value)),
    decode: (data: Buffer) => superjson.parse<T>(data.toString()),
  }
}
