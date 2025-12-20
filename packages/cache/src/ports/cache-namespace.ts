import type { CacheKey } from "./cache-key"

/**
 * CacheNamespace defines a logical namespace used to construct cache keys.
 *
 * @remarks
 * Namespaces are an application-level concern. They are used to prevent
 * collisions between different logical caches that share the same underlying
 * cache backend (e.g. Redis).
 *
 * A namespace typically represents:
 * - a cache instance (e.g. "users-by-id")
 * - a versioned cache shape (e.g. "users-by-id:v1")
 *
 * Namespaces are composed with adapter-level key prefixes:
 *
 * @example
 * ```
 * <adapter prefix> + <namespace prefix> + ":" + <key parts>
 * ```
 *
 * Cache adapters treat {@link CacheKey} values as opaque strings and do not
 * interpret or validate namespace structure.
 */
export interface CacheNamespace {
  /**
   * String prefix identifying this namespace.
   *
   * This value should be stable, unique within the application, and ideally
   * versioned to support safe cache evolution.
   */
  readonly prefix: string

  /**
   * Construct a cache key within this namespace.
   *
   * @param parts Components that uniquely identify an entry within the
   * namespace (e.g. IDs, parameters).
   */
  key(...parts: readonly (string | number)[]): CacheKey
}
