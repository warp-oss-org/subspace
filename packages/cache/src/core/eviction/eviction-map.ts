/**
 * Internal abstraction for eviction-aware key/value storage used by
 * in-memory caches.
 *
 * Encapsulates ordering and eviction behavior (e.g. LRU, FIFO) behind a
 * minimal Map-like interface. Intended for internal use by cache
 * implementations only.
 */
export interface EvictionMap<K, V> {
  /**
   * Retrieve the value for the given key.
   *
   * Implementations may update internal ordering as a side effect
   * (e.g. touch-on-read for LRU).
   */
  get(key: K): V | undefined

  /**
   * Insert or update the value for the given key.
   *
   * Implementations may update internal ordering as a side effect.
   */
  set(key: K, value: V): void

  /**
   * Remove the given key from the map.
   *
   * Returns true if the key was present.
   */
  delete(key: K): boolean

  /**
   * Check whether the map contains the given key.
   */
  has(key: K): boolean

  /**
   * Return the current number of entries.
   */
  size(): number

  /**
   * Return the next key that should be evicted according to the
   * implementation's eviction policy, or `undefined` if empty.
   */
  victim(): K | undefined
}
