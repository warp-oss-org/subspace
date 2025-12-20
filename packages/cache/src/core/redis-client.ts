import { RESP_TYPES, type RedisClientType } from "redis"
export type RedisBytesClient = {
  get(key: string): Promise<Buffer | null>
  mGet(keys: readonly string[]): Promise<(Buffer | null)[]>

  set(
    key: string,
    value: Uint8Array | Buffer,
    opts?: { EX?: number; PX?: number; EXAT?: number; PXAT?: number },
  ): Promise<unknown>

  del(...keys: readonly string[]): Promise<number>

  multi(): {
    set(
      key: string,
      value: Uint8Array | Buffer,
      opts?: { EX?: number; PX?: number; EXAT?: number; PXAT?: number },
    ): unknown
    del(...keys: readonly string[]): unknown
    exec(): Promise<unknown>
  }
}

export function createRedisBufferClient(redis: RedisClientType): RedisBytesClient {
  return redis.withTypeMapping({
    [RESP_TYPES.BLOB_STRING]: Buffer,
  }) as unknown as RedisBytesClient
}
