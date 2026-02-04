import type {
  BytesKeyValueStore,
  BytesKeyValueStoreCas,
  BytesKeyValueStoreConditional,
} from "../../ports/bytes-kv-store"
import type { Codec } from "../../ports/codec"
import type { KeyValueStoreCas } from "../../ports/kv-cas"
import type { KeyValueStoreConditional } from "../../ports/kv-conditional"
import { CodecKeyValueStoreCas } from "./codec-kv-cas"
import { CodecKeyValueStoreCasConditional } from "./codec-kv-cas-conditional"
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

export function createCodecKeyValueStoreCasConditional<T>(deps: {
  bytesStore: BytesKeyValueStoreCas & BytesKeyValueStoreConditional
  codec: Codec<T>
}): KeyValueStoreCas<T> & KeyValueStoreConditional<T> {
  return new CodecKeyValueStoreCasConditional<T>(deps)
}
