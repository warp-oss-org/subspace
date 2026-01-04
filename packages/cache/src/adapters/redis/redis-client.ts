import { createClient, RESP_TYPES } from "redis"

export type RedisTtl =
  | { EX: number }
  | { PX: number }
  | { EXAT: number }
  | { PXAT: number }
  | { KEEPTTL: true }

export type RedisBytesClient = {
  get(key: string): Promise<Buffer | null>
  mGet(keys: readonly string[]): Promise<(Buffer | null)[]>

  quit(): Promise<void>
  connect(): Promise<void>
  isOpen: boolean

  keys(pattern: string): Promise<Buffer[]>
  unlink(...keys: string[]): Promise<number>

  pTTL(key: string): Promise<number>

  set(key: string, value: Uint8Array | Buffer, opts?: RedisTtl): Promise<unknown>

  del(keys: string | readonly string[]): Promise<number>

  multi(): {
    set(key: string, value: Uint8Array | Buffer, opts?: RedisTtl): unknown
    del(keys: string | readonly string[]): unknown
    exec(): Promise<unknown>
  }
}

export function createRedisBytesClient(url: string): RedisBytesClient {
  return createClient({ url }).withTypeMapping({
    [RESP_TYPES.BLOB_STRING]: Buffer,
  }) as unknown as RedisBytesClient
}
