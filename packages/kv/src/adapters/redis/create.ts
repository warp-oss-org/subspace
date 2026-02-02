import { createClient, RESP_TYPES, type RedisClientOptions } from "redis"
import {
  createCodecKeyValueStore,
  createCodecKeyValueStoreCas,
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
import { RedisBytesKeyValueStoreCas } from "./redis-bytes-kv-cas"
import { RedisBytesKeyValueStoreConditional } from "./redis-bytes-kv-conditional"
import type { RedisKvStoreOptions } from "./redis-bytes-kv-store"
import { RedisBytesKeyValueStore } from "./redis-bytes-kv-store"
import type { RedisBytesClient } from "./redis-client"

export type RedisBytesClientOptions = { url: string } & Omit<RedisClientOptions, "url">

export function createRedisClient(options: RedisBytesClientOptions): RedisBytesClient {
  return createClient({ ...options, url: options.url }).withTypeMapping({
    [RESP_TYPES.BLOB_STRING]: Buffer,
  }) as unknown as RedisBytesClient
}

function mergeCasAndConditional<T>(
  cas: KeyValueStoreCas<T>,
  conditional: KeyValueStoreConditional<T>,
): KeyValueStoreCas<T> & KeyValueStoreConditional<T> {
  return {
    setIfExists: conditional.setIfExists.bind(conditional),
    setIfNotExists: conditional.setIfNotExists.bind(conditional),

    getVersioned: cas.getVersioned.bind(cas),
    setIfVersion: cas.setIfVersion.bind(cas),
    get: cas.get.bind(cas),
    set: cas.set.bind(cas),
    delete: cas.delete.bind(cas),
    has: cas.has.bind(cas),
    getMany: cas.getMany.bind(cas),
    setMany: cas.setMany.bind(cas),
    deleteMany: cas.deleteMany.bind(cas),
  }
}

export type RedisKvBundleOptions = {
  client: RedisBytesClient
  opts: RedisKvStoreOptions
}

/**
 * Creates the raw bytes stores once and reuses them for all codec stores.
 *
 * @remarks
 * - Caller owns `client.connect()` / `client.quit()`.
 * - `opts` must be consistent across all variants.
 */
function createRedisBytesStores(options: RedisKvBundleOptions): {
  kv: BytesKeyValueStore
  conditional: BytesKeyValueStoreConditional
  cas: BytesKeyValueStoreCas
} {
  const kv = new RedisBytesKeyValueStore({ client: options.client }, options.opts)

  const conditional = new RedisBytesKeyValueStoreConditional(
    { client: options.client, baseStore: kv },
    options.opts,
  )

  const cas = new RedisBytesKeyValueStoreCas({ client: options.client }, options.opts)

  return { kv, conditional, cas }
}

/**
 * Creates codec-backed stores from a single underlying bytes store bundle.
 */
function createRedisKeyValueStores<T>(
  options: RedisKvBundleOptions & { codec: Codec<T> },
): {
  kv: KeyValueStore<T>
  conditional: KeyValueStoreConditional<T>
  cas: KeyValueStoreCas<T>
  casAndConditional: KeyValueStoreCas<T> & KeyValueStoreConditional<T>
} {
  const bytes = createRedisBytesStores(options)

  const kv = createCodecKeyValueStore({ bytesStore: bytes.kv, codec: options.codec })

  const conditional = createCodecKeyValueStoreConditional({
    bytesStore: bytes.conditional,
    codec: options.codec,
  })

  const cas = createCodecKeyValueStoreCas({ bytesStore: bytes.cas, codec: options.codec })

  return {
    kv,
    conditional,
    cas,
    casAndConditional: mergeCasAndConditional(cas, conditional),
  }
}

export function createRedisKeyValueStore<T>(
  options: RedisKvBundleOptions & { codec: Codec<T> },
): KeyValueStore<T> {
  return createRedisKeyValueStores(options).kv
}

export function createRedisKeyValueStoreConditional<T>(
  options: RedisKvBundleOptions & { codec: Codec<T> },
): KeyValueStoreConditional<T> {
  return createRedisKeyValueStores(options).conditional
}

export function createRedisKeyValueStoreCas<T>(
  options: RedisKvBundleOptions & { codec: Codec<T> },
): KeyValueStoreCas<T> {
  return createRedisKeyValueStores(options).cas
}

export function createRedisKeyValueStoreCasAndConditional<T>(
  options: RedisKvBundleOptions & { codec: Codec<T> },
): KeyValueStoreCas<T> & KeyValueStoreConditional<T> {
  return createRedisKeyValueStores(options).casAndConditional
}
