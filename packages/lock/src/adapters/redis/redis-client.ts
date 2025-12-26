import { createClient } from "redis"

export type RedisTtl = {
  EX?: number
  PX?: number
  EXAT?: number
  PXAT?: number
  NX?: boolean
}

export type RedisClient = {
  set(
    key: string,
    value: Uint8Array | Buffer | string,
    opts?: RedisTtl,
  ): Promise<"OK" | null>

  eval(script: string, opts: { keys: string[]; arguments: string[] }): Promise<unknown>

  connect(): Promise<void>
  quit(): Promise<void>
  isOpen: boolean
}

export function createRedisClient({ url }: { url: string }): RedisClient {
  return createClient({ url }) as unknown as RedisClient
}
