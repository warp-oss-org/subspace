import type { KvKey } from "./kv-key"
import type { KvSetOptions } from "./kv-options"
import type { KvResult } from "./kv-result"
import type { KvEntry } from "./kv-value"

/**
 * KeyValueStore represents persistent, authoritative key-value storage.
 *
 * @remarks
 * - Data stored here is the source of truth.
 * - Operations should be durable - successful writes must persist.
 * - Unlike DataCache, entries are not evicted arbitrarily.
 *
 * If you can afford to lose this data or rebuild it from elsewhere,
 * consider using DataCache instead.
 */
export interface KeyValueStore<T> {
  /**
   * Retrieve a value by key.
   *
   * @remarks
   * - A miss means the key does not exist in the store.
   *
   * @param key Key identifying the entry.
   */
  get(key: KvKey): Promise<KvResult<T>>

  /**
   * Store a value.
   *
   * @remarks
   * - Overwrites existing values by default.
   *
   * @param key Key identifying the entry.
   * @param value Value to store.
   * @param opts Optional write options.
   */
  set(key: KvKey, value: T, opts?: Partial<KvSetOptions>): Promise<void>

  /**
   * Delete a value.
   *
   * @remarks
   * - Deleting a non-existent key is a no-op (idempotent).
   *
   * @param key Key to delete.
   */
  delete(key: KvKey): Promise<void>

  /**
   * Check if a key exists.
   *
   * @remarks
   * - More efficient than get() when you don't need the value.
   *
   * @param key Key to check.
   */
  has(key: KvKey): Promise<boolean>

  /**
   * Retrieve multiple values.
   *
   * @remarks
   * - Results are returned per key.
   * - Implementations should batch where possible.
   *
   * @param keys Keys to retrieve.
   */
  getMany(keys: readonly KvKey[]): Promise<Map<KvKey, KvResult<T>>>

  /**
   * Store multiple values.
   *
   * @remarks
   * - Atomicity is implementation-dependent.
   * - All entries share the same write options.
   *
   * @param entries Entries to write.
   * @param opts Optional write options.
   */
  setMany(entries: readonly KvEntry<T>[], opts?: Partial<KvSetOptions>): Promise<void>

  /**
   * Delete multiple values.
   *
   * @remarks
   * - Deleting non-existent keys is a no-op.
   *
   * @param keys Keys to delete.
   */
  deleteMany(keys: readonly KvKey[]): Promise<void>
}
