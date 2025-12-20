/* eslint-disable @typescript-eslint/no-unused-vars */
/** biome-ignore-all lint/correctness/noUnusedFunctionParameters: ignore for now */
import type { RedisClientType } from "redis"
import type { BytesCache } from "../../ports/bytes-cache"
import type { CacheEntry } from "../../ports/cache-entry"
import type { CacheKey } from "../../ports/cache-key"
import type {
  CacheGetOptions,
  CacheInvalidateOptions,
  CacheSetOptions,
} from "../../ports/cache-options"
import type { CacheResult } from "../../ports/cache-result"
import type { KeyspacePrefix } from "../../ports/keyspace-prefix"

export type RedisBytesCacheOptions = {
  keyPrefix: KeyspacePrefix
}

export class RedisBytesCache implements BytesCache {
  public constructor(
    private readonly redis: RedisClientType,
    private readonly opts: RedisBytesCacheOptions,
  ) {}

  async get(
    key: CacheKey,
    opts?: Partial<CacheGetOptions>,
  ): Promise<CacheResult<Uint8Array>> {
    const buffer = (await this.redis.get(this.fullKey(key))) as Buffer | null

    if (!buffer) return { kind: "miss" }

    return { kind: "hit", value: new Uint8Array(buffer) }
  }

  async set(
    key: CacheKey,
    value: Uint8Array<ArrayBufferLike>,
    opts?: Partial<CacheSetOptions>,
  ): Promise<void> {
    throw new Error("Method not implemented.")
  }

  async invalidate(key: CacheKey, opts?: Partial<CacheInvalidateOptions>): Promise<void> {
    throw new Error("Method not implemented.")
  }

  async getMany(
    keys: readonly CacheKey[],
    opts?: Partial<CacheGetOptions>,
  ): Promise<Map<string, CacheResult<Uint8Array<ArrayBufferLike>>>> {
    throw new Error("Method not implemented.")
  }

  async setMany(
    entries: readonly CacheEntry<Uint8Array<ArrayBufferLike>>[],
    opts?: Partial<CacheSetOptions>,
  ): Promise<void> {
    throw new Error("Method not implemented.")
  }

  async invalidateMany(
    keys: readonly CacheKey[],
    opts?: Partial<CacheInvalidateOptions>,
  ): Promise<void> {
    throw new Error("Method not implemented.")
  }

  private fullKey(k: CacheKey): string {
    return `${this.opts.keyPrefix}${k}`
  }
}
