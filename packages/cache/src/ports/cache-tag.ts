/**
 * CacheTag is intentionally a plain string.
 *
 * Tags are used for coarse-grained invalidation across related cache entries.
 *
 * @remarks
 * - Tags should be stable and low-cardinality.
 * - Avoid per-entity values (e.g. user IDs or request IDs).
 * - Prefer semantic groupings like "users", "feature-flags", etc.
 * - If you want stronger compile-time guarantees, you can switch this to
 * a branded type in your own codebase.
 *
 * @example
 * ```ts
 * const tag: CacheTag = "users.by-id"
 * ```
 *
 */
export type CacheTag = string
