export type CacheHit<T> = {
  kind: "hit"
  value: T
}

export type CacheMiss = {
  kind: "miss"
}

export type CacheResult<T> = CacheHit<T> | CacheMiss
