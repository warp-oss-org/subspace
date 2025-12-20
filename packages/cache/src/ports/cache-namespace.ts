import type { CacheKey } from "./cache-key"

export interface CacheNamespace {
  readonly prefix: string

  key(...parts: readonly (string | number)[]): CacheKey
}
