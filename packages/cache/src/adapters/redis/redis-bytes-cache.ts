import type { RedisBytesClient } from "../../core/redis-client"
import type { BytesCache } from "../../ports/bytes-cache"
import type { CacheEntry } from "../../ports/cache-entry"
import type { CacheKey } from "../../ports/cache-key"
import type { CacheSetOptions, CacheTtl } from "../../ports/cache-options"
import type { CacheResult } from "../../ports/cache-result"
import type { KeyspacePrefix } from "../../ports/keyspace-prefix"

type RedisBytesCacheOptions = {
  /**
   * Maximum number of keys processed in a single Redis operation when using
   * bulk methods (`getMany`, `setMany`, `invalidateMany`).
   *
   * Large bulk requests are automatically split into batches of this size
   * to avoid oversized Redis commands and uneven load spikes.
   *
   * Typical values are in the range of 500–2000.
   */
  batchSize: number

  keyspacePrefix: KeyspacePrefix
}

type RedisTtl = { EX?: number; PX?: number; EXAT?: number; PXAT?: number }

export class RedisBytesCache implements BytesCache {
  public constructor(
    private readonly client: RedisBytesClient,
    private readonly opts: RedisBytesCacheOptions,
  ) {}

  async get(key: CacheKey): Promise<CacheResult<Uint8Array>> {
    const buffer = await this.client.get(this.fullKey(key))

    return this.createCacheResult(buffer)
  }

  async set(
    key: CacheKey,
    value: Uint8Array,
    opts?: Partial<CacheSetOptions>,
  ): Promise<void> {
    const fullKey = this.fullKey(key)

    if (opts?.ttl) {
      await this.client.set(fullKey, value, this.toRedisTtl(opts.ttl))
    } else {
      await this.client.set(fullKey, value)
    }
  }

  async invalidate(key: CacheKey): Promise<void> {
    await this.client.del(this.fullKey(key))
  }

  async getMany(
    keys: readonly CacheKey[],
  ): Promise<Map<CacheKey, CacheResult<Uint8Array>>> {
    if (keys.length === 0) return new Map()

    const out = new Map<CacheKey, CacheResult<Uint8Array>>()

    for (const batch of this.chunks(keys, this.opts.batchSize)) {
      const fullKeys = batch.map((k) => this.fullKey(k))
      const buffers = await this.client.mGet(fullKeys)

      for (const [i, key] of batch.entries()) {
        out.set(key, this.createCacheResult(buffers[i] ?? null))
      }
    }

    return out
  }

  async setMany(
    entries: readonly CacheEntry<Uint8Array>[],
    opts?: Partial<CacheSetOptions>,
  ): Promise<void> {
    if (entries.length === 0) return

    const ttl = opts?.ttl ? this.toRedisTtl(opts.ttl) : undefined

    for (const batch of this.chunks(entries, this.opts.batchSize)) {
      const tx = this.client.multi()

      for (const [key, value] of batch) {
        const fullKey = this.fullKey(key)
        if (ttl) tx.set(fullKey, value, ttl)
        else tx.set(fullKey, value)
      }

      await tx.exec()
    }
  }

  async invalidateMany(keys: readonly CacheKey[]): Promise<void> {
    if (keys.length === 0) return

    const fullKeys = keys.map((k) => this.fullKey(k))

    for (const batch of this.chunks(fullKeys, this.opts.batchSize)) {
      await this.client.del(...batch)
    }
  }

  private *chunks<T>(items: readonly T[], size: number): Generator<readonly T[]> {
    for (let i = 0; i < items.length; i += size) {
      yield items.slice(i, i + size)
    }
  }

  private createCacheResult(buffer: Buffer | null): CacheResult<Uint8Array> {
    if (buffer === null) return { kind: "miss" }

    return { kind: "hit", value: new Uint8Array(buffer) }
  }

  private toRedisTtl(ttl: CacheTtl): RedisTtl {
    if (ttl.kind === "seconds") return { EX: ttl.seconds }
    if (ttl.kind === "milliseconds") return { PX: ttl.milliseconds }

    const ms = ttl.expiresAt.getTime()
    const sec = Math.floor(ms / 1000)

    return { EXAT: sec }
  }

  private fullKey(k: CacheKey): string {
    return `${this.opts.keyspacePrefix}${k}`
  }
}
