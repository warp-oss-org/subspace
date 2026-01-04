import type { KvKey } from "./kv-key"
import type { KvSetOptions } from "./kv-options"
import type { KeyValueStore } from "./kv-store"

/**
 * Result of a conditional write operation.
 */
export type KvWriteResult = { readonly kind: "written" } | { readonly kind: "skipped" }

/**
 * Extends KeyValueStore with conditional write operations.
 *
 * @remarks
 * Conditional writes allow atomic "write if condition" semantics without
 * requiring a separate read. Useful for:
 * - Acquiring locks
 * - Claiming unique resources (usernames, slugs)
 * - Ensuring idempotent creates
 *
 * Adapters must implement these atomically - emulating via read-then-write
 * is not safe and should not be done.
 */
export interface KeyValueStoreConditional<T> extends KeyValueStore<T> {
  /**
   * Store a value only if the key does not already exist.
   */
  setIfNotExists(
    key: KvKey,
    value: T,
    opts?: Partial<KvSetOptions>,
  ): Promise<KvWriteResult>

  /**
   * Store a value only if the key already exists.
   */
  setIfExists(key: KvKey, value: T, opts?: Partial<KvSetOptions>): Promise<KvWriteResult>
}
