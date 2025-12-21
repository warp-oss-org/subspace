import type { CacheKey } from "../../ports/cache-key"
import type { CacheSetOptions } from "../../ports/cache-options"

/**
 * Read-through capability (policy-level).
 * Implementations decide behavior (single-flight, retries, cache error handling, etc).
 */
export interface ReadThrough<T> {
  getThrough(
    key: CacheKey,
    loader: () => Promise<T>,
    opts?: Partial<CacheSetOptions>,
  ): Promise<T>
}
