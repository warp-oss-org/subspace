import type { EvictionMap } from "./eviction-map"

export class LruMemoryMap<K, V> implements EvictionMap<K, V> {
  private readonly map = new Map<K, V>()

  get(key: K): V | undefined {
    const value = this.map.get(key)

    if (value === undefined) return undefined

    this.markMostRecentlyUsed(key, value)

    return value
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key)

    this.map.set(key, value)
  }

  delete(key: K): boolean {
    return this.map.delete(key)
  }

  has(key: K): boolean {
    return this.map.has(key)
  }

  size(): number {
    return this.map.size
  }

  victim(): K | undefined {
    return this.map.keys().next().value as K | undefined
  }

  private markMostRecentlyUsed(key: K, value: V): void {
    this.map.delete(key)
    this.map.set(key, value)
  }
}
