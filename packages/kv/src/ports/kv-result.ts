export type KvFound<T> = {
  readonly kind: "found"
  readonly value: T
}

export type KvNotFound = {
  readonly kind: "not_found"
}

/**
 * Result of a KV get operation.
 *
 * @remarks
 * Unlike cache, a miss here means the data doesn't exist - not that it was evicted.
 */
export type KvResult<T> = KvFound<T> | KvNotFound
