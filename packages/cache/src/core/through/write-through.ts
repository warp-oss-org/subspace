import type { CacheKey } from "../../ports/cache-key"
import type { CacheSetOptions } from "../../ports/cache-options"

/**
 * Write-through capability (policy-level).
 * Implementations decide whether to set vs invalidate, swallow cache errors, retry, etc.
 */
export interface WriteThrough<T> {
  setThrough(
    key: CacheKey,
    value: T,
    writer: (value: T) => Promise<void>,
    opts?: Partial<CacheSetOptions>,
  ): Promise<void>
}
