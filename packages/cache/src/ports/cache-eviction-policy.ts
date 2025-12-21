/**
 * Least Recently Used (LRU) eviction policy.
 *
 * Evicts the entry that has not been accessed for the longest time.
 * Common default for memory caches with good hit-rate characteristics.
 */
export type LruCacheEvictionPolicy = "lru"

/**
 * First In, First Out (FIFO) eviction policy.
 *
 * Evicts entries in insertion order, regardless of access patterns.
 * Simpler and more predictable, but usually lower hit rates than LRU.
 */
export type FifoCacheEvictionPolicy = "fifo"

export type CacheEvictionPolicy = LruCacheEvictionPolicy | FifoCacheEvictionPolicy
