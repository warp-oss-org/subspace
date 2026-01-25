export type RedisTtl =
  | { EX: number }
  | { PX: number }
  | { NX: true }
  | { XX: true }
  | { EXAT: number }
  | { PXAT: number }
  | { KEEPTTL: true }

export type RedisBytesClient = {
  get(key: string): Promise<Buffer | null>
  mGet(keys: readonly string[]): Promise<(Buffer | null)[]>

  exists(keys: string | readonly string[]): Promise<number>

  quit(): Promise<void>
  connect(): Promise<void>
  isOpen: boolean

  incr(key: string): Promise<number>
  pExpire(key: string, ms: number): Promise<boolean>

  pTTL(key: string): Promise<number>

  keys(pattern: string): Promise<Buffer[]>
  unlink(...keys: string[]): Promise<number>

  set(
    key: string,
    value: Uint8Array | Buffer,
    opts?: RedisTtl & { NX?: boolean; XX?: boolean },
  ): Promise<string | null>

  del(keys: string | readonly string[]): Promise<number>

  watch(keys: string | readonly string[]): Promise<void>
  unwatch(): Promise<void>

  scan(
    cursor: string,
    opts?: { MATCH?: string; COUNT?: number },
  ): Promise<{ cursor: string; keys: string[] }>

  multi(): {
    set(key: string, value: Uint8Array | Buffer, opts?: RedisTtl): unknown
    del(keys: string | readonly string[]): unknown
    incr(key: string): unknown
    pExpire(key: string, ms: number): unknown
    eval(
      script: string,
      opts: { keys: string[]; arguments: (string | Buffer)[] },
    ): unknown
    exec(): Promise<unknown>
  }

  eval(
    script: string,
    opts: { keys: string[]; arguments: (string | Buffer)[] },
  ): Promise<unknown>
}
