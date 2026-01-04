import type { KeyValueStoreCas } from "./kv-cas"
import type { KeyValueStoreConditional } from "./kv-conditional"
import type { KeyValueStore } from "./kv-store"

export type BytesKeyValueStore = KeyValueStore<Uint8Array>
export type BytesKeyValueStoreConditional = KeyValueStoreConditional<Uint8Array>
export type BytesKeyValueStoreCas = KeyValueStoreCas<Uint8Array>
