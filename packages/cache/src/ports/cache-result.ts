/**
 * Best-effort metadata associated with a cache entry or cache lookup.
 *
 * @remarks
 * Metadata is intentionally unstructured and optional. It is intended for:
 * - observability (logging, metrics, tracing)
 * - debugging (e.g. why a value was a miss)
 * - adapter-specific hints
 *
 * Consumers must NOT rely on the presence or shape of metadata for correctness.
 * Different adapters may populate different fields, or none at all.
 *
 * Typical examples (non-exhaustive):
 * - remaining TTL or expiry timestamp
 * - whether a value was served from a local vs remote cache
 * - backend-specific flags or diagnostics
 */
export type CacheEntryMetadata = Record<string, unknown>

export type CacheHit<T> = {
  kind: "hit"
  value: T
  meta?: CacheEntryMetadata
}

export type CacheMiss = {
  kind: "miss"
  meta?: CacheEntryMetadata
}

export type CacheResult<T> = CacheHit<T> | CacheMiss
