import type { Codec } from "@subspace/kv"
import superjson from "superjson"

const decoder = new TextDecoder()
export function createJsonCodec<T>(): Codec<T> {
  return {
    encode: (value: T) => Buffer.from(superjson.stringify(value), "utf8"),
    decode: (data: Uint8Array) => superjson.parse<T>(decoder.decode(data)),
  }
}
