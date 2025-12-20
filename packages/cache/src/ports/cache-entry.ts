import type { CacheKey } from "./cache-key"

/**
 * A key–value pair used for bulk cache writes.
 */
export type CacheEntry<T> = readonly [CacheKey, T]
