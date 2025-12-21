import type { EvictionMap } from "./eviction-map"

export class FifoMemoryMap<K, V> implements EvictionMap<K, V> {
  private readonly map = new Map<K, V>()

  get(key: K): V | undefined {
    return this.map.get(key)
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.set(key, value)

      return
    }

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
}
