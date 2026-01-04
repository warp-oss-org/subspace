import type { BytesKeyValueStore } from "../../ports/bytes-kv-store"
import type { KeyspacePrefix } from "../../ports/keyspace-prefix"
import type { KvKey } from "../../ports/kv-key"
import type { KvSetOptions, KvTtl } from "../../ports/kv-options"
import type { KvResult } from "../../ports/kv-result"
import type { KvEntry } from "../../ports/kv-value"
import type { RedisBytesClient, RedisTtl } from "./redis-client"

export type RedisKvStoreOptions = {
  /**
   * Maximum number of keys processed in a single Redis operation when using
   * bulk methods (`getMany`, `setMany`, `deleteMany`).
   *
   * Large bulk requests are automatically split into batches of this size
   * to avoid oversized Redis commands and uneven load spikes.
   *
   * Typical values are in the range of 500–2000.
   */
  batchSize: number

  keyspacePrefix: KeyspacePrefix
}

export class RedisBytesKeyValueStore implements BytesKeyValueStore {
  public constructor(
    private readonly client: RedisBytesClient,
    private readonly opts: RedisKvStoreOptions,
  ) {}

  async get(key: KvKey): Promise<KvResult<Uint8Array>> {
    const buffer = await this.client.get(this.fullKey(key))

    return this.createKvResult(buffer)
  }

  async set(key: KvKey, value: Uint8Array, opts?: Partial<KvSetOptions>): Promise<void> {
    const fullKey = this.fullKey(key)
    const buffer = this.toBuffer(value)

    if (opts?.ttl) {
      await this.client.set(fullKey, buffer, this.toRedisTtl(opts.ttl))
    } else {
      await this.client.set(fullKey, buffer, { KEEPTTL: true })
    }
  }

  async delete(key: KvKey): Promise<void> {
    await this.client.del(this.fullKey(key))
  }

  async has(key: KvKey): Promise<boolean> {
    const exists = await this.client.exists(this.fullKey(key))

    return exists === 1
  }

  async getMany(keys: readonly KvKey[]): Promise<Map<KvKey, KvResult<Uint8Array>>> {
    if (keys.length === 0) return new Map()

    const out = new Map<KvKey, KvResult<Uint8Array>>()

    for (const batch of this.chunks(keys, this.opts.batchSize)) {
      const fullKeys = batch.map((k) => this.fullKey(k))
      const buffers = await this.client.mGet(fullKeys)

      for (const [i, key] of batch.entries()) {
        out.set(key, this.createKvResult(buffers[i] ?? null))
      }
    }

    return out
  }

  async setMany(
    entries: readonly KvEntry<Uint8Array>[],
    opts?: Partial<KvSetOptions>,
  ): Promise<void> {
    if (entries.length === 0) return

    const ttl: RedisTtl = opts?.ttl ? this.toRedisTtl(opts.ttl) : { KEEPTTL: true }

    for (const batch of this.chunks(entries, this.opts.batchSize)) {
      const tx = this.client.multi()

      for (const [key, value] of batch) {
        const fullKey = this.fullKey(key)
        const buf = this.toBuffer(value)
        tx.set(fullKey, buf, ttl)
      }

      await tx.exec()
    }
  }

  async deleteMany(keys: readonly KvKey[]): Promise<void> {
    if (keys.length === 0) return

    for (const batch of this.chunks(keys, this.opts.batchSize)) {
      await this.client.del(batch.map((k) => this.fullKey(k)))
    }
  }

  private *chunks<T>(items: readonly T[], size: number): Generator<readonly T[]> {
    for (let i = 0; i < items.length; i += size) {
      yield items.slice(i, i + size)
    }
  }

  private toRedisTtl(ttl: KvTtl): RedisTtl {
    return { PX: ttl.milliseconds }
  }

  private toBuffer(value: Uint8Array): Buffer {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
  }

  private createKvResult(buffer: Buffer | null): KvResult<Uint8Array> {
    if (buffer === null) return { kind: "not_found" }

    return { kind: "found", value: new Uint8Array(buffer) }
  }

  private fullKey(k: KvKey): string {
    return `${this.opts.keyspacePrefix}${k}`
  }
}
