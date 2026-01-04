import type { KvKey } from "./kv-key"
import type { KvSetOptions } from "./kv-options"
import type { KvNotFound } from "./kv-result"
import type { KeyValueStore } from "./kv-store"

/**
 * Opaque version token returned by the backing store.
 *
 * @remarks
 * Version format is implementation-dependent (e.g., etag, timestamp, counter).
 * Consumers should treat this as opaque and only use it for CAS comparisons.
 */
export type KvVersion = string

/**
 * Result of a get operation that includes version information.
 */
export type KvFoundVersioned<T> = {
  readonly kind: "found"
  readonly value: T
  readonly version: KvVersion
}

export type KvResultVersioned<T> = KvFoundVersioned<T> | KvNotFound

/**
 * Result of a compare-and-swap operation.
 */
export type KvCasResult =
  | { readonly kind: "written"; readonly version: KvVersion }
  | { readonly kind: "conflict" }
  | { readonly kind: "not_found" }

/**
 * Extends KeyValueStore with compare-and-swap (optimistic concurrency) support.
 *
 * @remarks
 * CAS enables safe concurrent updates by conditioning writes on the value
 * not having changed since it was read. Useful for:
 * - Concurrent balance updates
 * - Collaborative editing
 * - Any read-modify-write cycle with multiple writers
 *
 * Adapters must implement this atomically using the backing store's native
 * CAS mechanism (e.g., Redis WATCH/MULTI, DynamoDB ConditionExpression).
 */
export interface KeyValueStoreCas<T> extends KeyValueStore<T> {
  /**
   * Retrieve a value along with its version token.
   */
  getVersioned(key: KvKey): Promise<KvResultVersioned<T>>

  /**
   * Store a value only if the current version matches.
   *
   * @remarks
   * Returns "conflict" if the value changed since the version was obtained.
   * Returns "not_found" if the key no longer exists.
   */
  setIfVersion(
    key: KvKey,
    value: T,
    expectedVersion: KvVersion,
    opts?: Partial<KvSetOptions>,
  ): Promise<KvCasResult>
}
