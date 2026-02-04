import type { Codec } from "@subspace/kv"
import superjson from "superjson"

const encoder = new TextEncoder()
const decoder = new TextDecoder("utf-8")

export function createJsonCodec<T>(): Codec<T> {
  return {
    encode: (value: T) => encoder.encode(superjson.stringify(value)),
    decode: (data: Uint8Array) => superjson.parse<T>(decoder.decode(data)),
  }
}
