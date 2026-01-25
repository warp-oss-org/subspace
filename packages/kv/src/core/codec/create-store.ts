import type {
  BytesKeyValueStore,
  BytesKeyValueStoreCas,
  BytesKeyValueStoreConditional,
} from "../../ports/bytes-kv-store"
import type { Codec } from "../../ports/codec"
import { CodecKeyValueStoreCas } from "./codec-kv-cas"
import { CodecKeyValueStoreConditional } from "./codec-kv-conditional"
import { CodecKeyValueStore } from "./codec-kv-store"

export function createCodecKeyValueStore<T>(deps: {
  bytesStore: BytesKeyValueStore
  codec: Codec<T>
}): CodecKeyValueStore<T> {
  return new CodecKeyValueStore<T>(deps)
}

export function createCodecKeyValueStoreConditional<T>(deps: {
  bytesStore: BytesKeyValueStoreConditional
  codec: Codec<T>
}): CodecKeyValueStoreConditional<T> {
  return new CodecKeyValueStoreConditional<T>(deps)
}

export function createCodecKeyValueStoreCas<T>(deps: {
  bytesStore: BytesKeyValueStoreCas
  codec: Codec<T>
}): CodecKeyValueStoreCas<T> {
  return new CodecKeyValueStoreCas<T>(deps)
}
