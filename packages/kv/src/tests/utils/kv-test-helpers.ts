import type { KvKey } from "../../ports/kv-key"

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
  one(): KvKey {
    return "k:one"
  },
  two(): KvKey {
    return "k:two"
  },
  three(): KvKey {
    return "k:three"
  },
  four(): KvKey {
    return "k:four"
  },
  five(): KvKey {
    return "k:five"
  },
}

export const entry = (key: KvKey, value: Uint8Array): [KvKey, Uint8Array] => {
  return [key, value]
}
