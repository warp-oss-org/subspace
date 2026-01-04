import type { KvKey } from "./kv-key"

/**
 * Represents a stored entry with metadata.
 */
export type KvEntry<T> = readonly [KvKey, T]
