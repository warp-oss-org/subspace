/**
 * CacheKey is intentionally a plain string for ergonomics.
 *
 * Keys _should_ be:
 * - stable
 * - namespaced
 * - versioned
 *
 * @remarks
 * - Avoid ad-hoc string interpolation at call sites. Prefer building keys via
 * a namespace helper so formats stay consistent and refactors are safe.
 *
 * - If you want stronger compile-time guarantees, you can switch this to
 * a branded type in your own codebase.
 *
 * @example
 * ```ts
 * const key: CacheKey = "users.by-id:v1:123"
 * ```
 */
export type CacheKey = string
