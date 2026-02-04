import type { Clock } from "@subspace/clock"
import {
  createCodecKeyValueStore,
  createCodecKeyValueStoreCas,
  createCodecKeyValueStoreCasConditional,
  createCodecKeyValueStoreConditional,
} from "../../core/codec/create-store"
import type {
  BytesKeyValueStore,
  BytesKeyValueStoreCas,
  BytesKeyValueStoreConditional,
} from "../../ports/bytes-kv-store"
import type { Codec } from "../../ports/codec"
import type { KeyValueStoreCas } from "../../ports/kv-cas"
import type { KeyValueStoreConditional } from "../../ports/kv-conditional"
import type { KeyValueStore } from "../../ports/kv-store"
import { MemoryBytesKeyValueStoreCas } from "./memory-bytes-kv-cas"
import { MemoryBytesKeyValueStoreCasConditional } from "./memory-bytes-kv-cas-and-conditional"
import { MemoryBytesKeyValueStoreConditional } from "./memory-bytes-kv-conditional"
import type { MemoryKvStoreOptions } from "./memory-bytes-kv-store"
import { MemoryBytesKeyValueStore } from "./memory-bytes-kv-store"

export type MemoryKvBundleOptions = {
  clock: Clock
  opts: MemoryKvStoreOptions
}

/**
 * Creates the raw bytes stores once and reuses them for all codec stores.
 */
function createMemoryBytesStores(options: MemoryKvBundleOptions): {
  kv: BytesKeyValueStore
  conditional: BytesKeyValueStoreConditional
  cas: BytesKeyValueStoreCas
  casAndConditional: BytesKeyValueStoreCas & BytesKeyValueStoreConditional
} {
  const kv = new MemoryBytesKeyValueStore({ clock: options.clock }, options.opts)

  const conditional = new MemoryBytesKeyValueStoreConditional(
    { clock: options.clock },
    options.opts,
  )

  const cas = new MemoryBytesKeyValueStoreCas({ clock: options.clock }, options.opts)
  const casAndConditional = new MemoryBytesKeyValueStoreCasConditional(
    { clock: options.clock },
    options.opts,
  )

  return { kv, conditional, cas, casAndConditional }
}

/**
 * Creates codec-backed stores from a single underlying bytes store bundle.
 */
function createMemoryKeyValueStores<T>(
  options: MemoryKvBundleOptions & { codec: Codec<T> },
): {
  kv: KeyValueStore<T>
  conditional: KeyValueStoreConditional<T>
  cas: KeyValueStoreCas<T>
  casAndConditional: KeyValueStoreCas<T> & KeyValueStoreConditional<T>
} {
  const bytes = createMemoryBytesStores(options)

  const kv = createCodecKeyValueStore({ bytesStore: bytes.kv, codec: options.codec })

  const conditional = createCodecKeyValueStoreConditional({
    bytesStore: bytes.conditional,
    codec: options.codec,
  })

  const cas = createCodecKeyValueStoreCas({ bytesStore: bytes.cas, codec: options.codec })
  const casAndConditional = createCodecKeyValueStoreCasConditional({
    bytesStore: bytes.casAndConditional,
    codec: options.codec,
  })

  return {
    kv,
    cas,
    conditional,
    casAndConditional,
  }
}

export function createMemoryKeyValueStore<T>(
  options: MemoryKvBundleOptions & { codec: Codec<T> },
): KeyValueStore<T> {
  return createMemoryKeyValueStores(options).kv
}

export function createMemoryKeyValueStoreConditional<T>(
  options: MemoryKvBundleOptions & { codec: Codec<T> },
): KeyValueStoreConditional<T> {
  return createMemoryKeyValueStores(options).conditional
}

export function createMemoryKeyValueStoreCas<T>(
  options: MemoryKvBundleOptions & { codec: Codec<T> },
): KeyValueStoreCas<T> {
  return createMemoryKeyValueStores(options).cas
}

export function createMemoryKeyValueStoreCasAndConditional<T>(
  options: MemoryKvBundleOptions & { codec: Codec<T> },
): KeyValueStoreCas<T> & KeyValueStoreConditional<T> {
  return createMemoryKeyValueStores(options).casAndConditional
}
