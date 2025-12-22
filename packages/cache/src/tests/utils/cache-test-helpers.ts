import type { CacheEntry } from "../../ports/cache-entry"
import type { CacheKey } from "../../ports/cache-key"

export const bytes = {
  a(): Uint8Array {
    return new Uint8Array([1, 2, 3])
  },
  b(): Uint8Array {
    return new Uint8Array([9, 8, 7])
  },
  c(): Uint8Array {
    return new Uint8Array([4, 5, 6])
  },
  empty(): Uint8Array {
    return new Uint8Array([])
  },
}

export const keys = {
  one(): CacheKey {
    return "k:one"
  },
  two(): CacheKey {
    return "k:two"
  },
  three(): CacheKey {
    return "k:three"
  },
  four(): CacheKey {
    return "k:four"
  },
  five(): CacheKey {
    return "k:five"
  },
}

export const entry = (key: CacheKey, value: Uint8Array): CacheEntry<Uint8Array> => {
  return [key, value]
}
