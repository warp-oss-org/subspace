import type { EvictionMap } from "../../core/eviction/eviction-map"
import type { Clock } from "../../core/time/clock"
import type { BytesCache } from "../../ports/bytes-cache"
import type { CacheEntry } from "../../ports/cache-entry"
import type { CacheKey } from "../../ports/cache-key"
import type { CacheSetOptions, CacheTtl } from "../../ports/cache-options"
import type { CacheResult } from "../../ports/cache-result"
import type { Milliseconds } from "../../ports/time"

export type MemoryCacheOptions = {
  /**
   * Maximum number of entries retained in the cache.
   *
   * When this limit is exceeded, entries are evicted according to
   * the configured eviction policy.
   */
  maxEntries: number
}

export type MemoryCacheDeps = {
  clock: Clock
  store: EvictionMap<CacheKey, MemoryCacheEntry>
}

export type MemoryCacheEntry = {
  value: Uint8Array
  expiresAtMs?: Milliseconds
}

export class MemoryBytesCache implements BytesCache {
  public constructor(
    private readonly deps: MemoryCacheDeps,
    private readonly opts: MemoryCacheOptions,
  ) {}

  async get(key: CacheKey): Promise<CacheResult<Uint8Array>> {
    const res = this.deps.store.get(key)

    return this.createCacheResult(key, res)
  }

  async set(
    key: CacheKey,
    value: Uint8Array,
    opts?: Partial<CacheSetOptions>,
  ): Promise<void> {
    const spaceNeeded = this.deps.store.has(key) ? 0 : 1
    this.ensureCapacityFor(spaceNeeded)

    this.setEntry(key, value, opts)
  }

  async invalidate(key: CacheKey): Promise<void> {
    this.deps.store.delete(key)
  }

  async getMany(
    keys: readonly CacheKey[],
  ): Promise<Map<CacheKey, CacheResult<Uint8Array>>> {
    if (keys.length === 0) return new Map()

    const out = new Map<CacheKey, CacheResult<Uint8Array>>()

    for (const key of keys) {
      const res = this.deps.store.get(key)
      out.set(key, this.createCacheResult(key, res))
    }

    return out
  }

  async setMany(
    entries: readonly CacheEntry<Uint8Array>[],
    opts?: Partial<CacheSetOptions>,
  ): Promise<void> {
    if (entries.length === 0) return

    const spaceNeeded = this.countNewUniqueKeys(entries)

    this.ensureCapacityFor(spaceNeeded)

    for (const [key, value] of entries) {
      this.setEntry(key, value, opts)
    }
  }

  async invalidateMany(keys: readonly CacheKey[]): Promise<void> {
    if (keys.length === 0) return

    for (const key of keys) {
      this.deps.store.delete(key)
    }
  }

  private setEntry(
    key: CacheKey,
    value: Uint8Array,
    opts?: Partial<CacheSetOptions>,
  ): void {
    if (opts?.ttl) {
      this.deps.store.set(key, {
        value,
        expiresAtMs: this.toExpiresAtMs(opts.ttl),
      })
    } else {
      this.deps.store.set(key, { value })
    }
  }

  private toExpiresAtMs(ttl: CacheTtl): Milliseconds {
    const ms = this.deps.clock.nowMs()

    if (ttl.kind === "seconds") return ms + ttl.seconds * 1000
    if (ttl.kind === "milliseconds") return ms + ttl.milliseconds

    return ttl.expiresAt.getTime()
  }

  private createCacheResult(
    key: CacheKey,
    res: MemoryCacheEntry | undefined,
  ): CacheResult<Uint8Array> {
    if (res === undefined) return { kind: "miss" }

    if (this.isExpired(res)) {
      this.deps.store.delete(key)
      return { kind: "miss" }
    }

    return { kind: "hit", value: res.value }
  }

  private isExpired(res: MemoryCacheEntry): boolean {
    if (res.expiresAtMs === undefined) return false

    return res.expiresAtMs <= this.deps.clock.nowMs()
  }

  private countNewUniqueKeys(entries: readonly CacheEntry<Uint8Array>[]): number {
    const uniqueKeys = new Set<CacheKey>()
    let spaceNeeded = 0

    for (const [key] of entries) {
      if (!uniqueKeys.has(key)) {
        uniqueKeys.add(key)
        if (!this.deps.store.has(key)) {
          spaceNeeded++
        }
      }
    }

    return spaceNeeded
  }

  private hasCapacityFor(spaceNeeded: number): boolean {
    return this.deps.store.size() + spaceNeeded <= this.opts.maxEntries
  }

  private ensureCapacityFor(spaceNeeded: number): void {
    if (spaceNeeded <= 0) return
    if (spaceNeeded > this.opts.maxEntries) {
      throw new RangeError(
        `Cannot insert ${spaceNeeded} new entries into a cache with maxEntries=${this.opts.maxEntries}.`,
      )
    }

    while (!this.hasCapacityFor(spaceNeeded)) {
      const victim = this.deps.store.victim()

      if (victim === undefined) {
        throw new Error(
          "Invariant violation: EvictionMap.victim() returned undefined while over capacity",
        )
      }

      this.deps.store.delete(victim)
    }
  }
}
