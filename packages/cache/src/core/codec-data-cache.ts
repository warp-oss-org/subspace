import type { BytesCache } from "../ports/bytes-cache"
import type { CacheEntry } from "../ports/cache-entry"
import type { CacheKey } from "../ports/cache-key"
import type { CacheSetOptions } from "../ports/cache-options"
import type { CacheResult } from "../ports/cache-result"
import type { Codec } from "../ports/codec"
import type { DataCache } from "../ports/data-cache"

export class CodecDataCache<T> implements DataCache<T> {
  public constructor(
    private readonly bytesCache: BytesCache,
    private readonly codec: Codec<T>,
  ) {}

  async get(key: CacheKey): Promise<CacheResult<T>> {
    const res = await this.bytesCache.get(key)

    return this.decodeResult(res)
  }

  async set(key: CacheKey, value: T, opts?: Partial<CacheSetOptions>): Promise<void> {
    await this.bytesCache.set(key, this.codec.encode(value), opts)
  }

  async invalidate(key: CacheKey): Promise<void> {
    await this.bytesCache.invalidate(key)
  }

  async getMany(keys: readonly CacheKey[]): Promise<Map<CacheKey, CacheResult<T>>> {
    const res = await this.bytesCache.getMany(keys)

    const out = new Map<CacheKey, CacheResult<T>>()
    for (const [k, v] of res.entries()) {
      out.set(k, this.decodeResult(v))
    }

    return out
  }

  async setMany(
    entries: readonly CacheEntry<T>[],
    opts?: Partial<CacheSetOptions>,
  ): Promise<void> {
    const encoded: readonly CacheEntry<Uint8Array>[] = entries.map(
      ([k, v]) => [k, this.codec.encode(v)] as const,
    )
    await this.bytesCache.setMany(encoded, opts)
  }

  async invalidateMany(keys: readonly CacheKey[]): Promise<void> {
    await this.bytesCache.invalidateMany(keys)
  }

  private decodeResult(res: CacheResult<Uint8Array>): CacheResult<T> {
    if (res.kind === "miss") {
      return {
        kind: "miss",
        ...(res.meta !== undefined ? { meta: res.meta } : {}),
      }
    }

    return {
      kind: "hit",
      value: this.codec.decode(res.value),
      ...(res.meta !== undefined ? { meta: res.meta } : {}),
    }
  }
}
