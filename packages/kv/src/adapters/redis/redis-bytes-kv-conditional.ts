import type {
  BytesKeyValueStore,
  BytesKeyValueStoreConditional,
} from "../../ports/bytes-kv-store"
import type { KvWriteResult } from "../../ports/kv-conditional"
import type { KvKey } from "../../ports/kv-key"
import type { KvSetOptions, KvTtl } from "../../ports/kv-options"
import type { KvResult } from "../../ports/kv-result"
import type { KvEntry } from "../../ports/kv-value"
import type { RedisKvStoreOptions } from "./redis-bytes-kv-store"
import type { RedisBytesClient, RedisTtl } from "./redis-client"

export type RedisBytesKvConditionalDeps = {
  client: RedisBytesClient
  baseStore: BytesKeyValueStore
}

export class RedisBytesKeyValueStoreConditional implements BytesKeyValueStoreConditional {
  public constructor(
    private readonly deps: RedisBytesKvConditionalDeps,
    private readonly opts: RedisKvStoreOptions,
  ) {}

  async setIfNotExists(
    key: KvKey,
    value: Uint8Array,
    opts?: Partial<KvSetOptions>,
  ): Promise<KvWriteResult> {
    const fullKey = this.fullKey(key)
    const buffer = this.toBuffer(value)

    const ttl = opts?.ttl ? this.toRedisTtl(opts.ttl) : undefined
    const result = await this.deps.client.set(fullKey, buffer, { ...ttl, NX: true })

    return result === "OK" ? { kind: "written" } : { kind: "skipped" }
  }

  async setIfExists(
    key: KvKey,
    value: Uint8Array,
    opts?: Partial<KvSetOptions>,
  ): Promise<KvWriteResult> {
    const fullKey = this.fullKey(key)
    const buffer = this.toBuffer(value)

    const ttl = opts?.ttl ? this.toRedisTtl(opts.ttl) : undefined
    const result = await this.deps.client.set(fullKey, buffer, { ...ttl, XX: true })

    return result === "OK" ? { kind: "written" } : { kind: "skipped" }
  }

  async get(key: KvKey): Promise<KvResult<Uint8Array>> {
    return await this.deps.baseStore.get(key)
  }

  async set(key: KvKey, value: Uint8Array, opts?: Partial<KvSetOptions>): Promise<void> {
    await this.deps.baseStore.set(key, value, opts)
  }

  async delete(key: KvKey): Promise<void> {
    await this.deps.baseStore.delete(key)
  }

  async has(key: KvKey): Promise<boolean> {
    return await this.deps.baseStore.has(key)
  }

  async getMany(keys: readonly KvKey[]): Promise<Map<KvKey, KvResult<Uint8Array>>> {
    return await this.deps.baseStore.getMany(keys)
  }

  async setMany(
    entries: readonly KvEntry<Uint8Array>[],
    opts?: Partial<KvSetOptions>,
  ): Promise<void> {
    await this.deps.baseStore.setMany(entries, opts)
  }

  async deleteMany(keys: readonly KvKey[]): Promise<void> {
    await this.deps.baseStore.deleteMany(keys)
  }

  private toRedisTtl(ttl: KvTtl): RedisTtl {
    return { PX: ttl.milliseconds }
  }

  private toBuffer(value: Uint8Array): Buffer {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
  }

  private fullKey(k: KvKey): string {
    return `${this.opts.keyspacePrefix}${k}`
  }
}
