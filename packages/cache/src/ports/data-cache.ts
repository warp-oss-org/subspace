import type { CacheEntry } from "./cache-entry"
import type { CacheKey } from "./cache-key"
import type {
  CacheGetOptions,
  CacheInvalidateOptions,
  CacheSetOptions,
} from "./cache-options"
import type { CacheResult } from "./cache-result"

/**
 * DataCache represents a cache for derived, non-authoritative data.
 *
 * @remarks
 * - Cached values may be evicted at any time.
 * - Cached values may be stale.
 * - Cache operations are best-effort; they must not be relied on for correctness.
 *
 * If losing this data would cause an incident, it does not belong behind this port.
 */
export interface DataCache<T> {
  /**
   * Retrieve a value from the cache.
   *
   * @remarks
   * - A cache miss does not imply absence in the source of truth.
   * - Adapters may return stale data depending on configuration and backend support.
   *
   * @param key Cache key identifying the entry.
   * @param opts Optional retrieval options (best-effort).
   */
  get(key: CacheKey, opts?: Partial<CacheGetOptions>): Promise<CacheResult<T>>

  /**
   * Store a value in the cache.
   *
   * @remarks
   * - Overwrites are allowed.
   * - The cache may still evict the entry earlier than requested.
   *
   * @param key Cache key identifying the entry.
   * @param value Value to cache.
   * @param opts Optional cache write options (e.g. TTL, tags).
   */
  set(key: CacheKey, value: T, opts?: Partial<CacheSetOptions>): Promise<void>

  /**
   * Invalidate a cached entry.
   *
   * @remarks
   * - Invalidation is best-effort.
   * - Adapters may translate this into deletes, expirations, or tag-based invalidation.
   *
   * @param key Cache key identifying the entry to invalidate.
   * @param opts Optional invalidation options.
   */
  invalidate(key: CacheKey, opts?: Partial<CacheInvalidateOptions>): Promise<void>

  /**
   * Retrieve multiple values from the cache.
   *
   * @remarks
   * - Implementations may batch, pipeline, or fall back to per-key reads.
   * - Results are returned per key; some entries may be hits while others are misses.
   *
   * @param keys Cache keys to retrieve.
   * @param opts Optional retrieval options.
   */
  getMany(
    keys: readonly CacheKey[],
    opts?: Partial<CacheGetOptions>,
  ): Promise<Map<CacheKey, CacheResult<T>>>

  /**
   * Store multiple values in the cache.
   *
   * @remarks
   * - All entries share the same write options.
   * - Implementations may batch or pipeline writes where supported.
   *
   * @param entries Cache entries to write.
   * @param opts Optional cache write options.
   */
  setMany(
    entries: readonly CacheEntry<T>[],
    opts?: Partial<CacheSetOptions>,
  ): Promise<void>

  /**
   * Invalidate multiple cached entries.
   *
   * @remarks
   * - Invalidation is best-effort and may be implemented via bulk deletes
   *   or tag-based mechanisms.
   *
   * @param keys Cache keys to invalidate.
   * @param opts Optional invalidation options.
   */
  invalidateMany(
    keys: readonly CacheKey[],
    opts?: Partial<CacheInvalidateOptions>,
  ): Promise<void>
}
