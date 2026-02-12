# @subspace/kv

Key-value storage with compare-and-swap (CAS) and conditional writes. Provides primitives for distributed state coordination.

## Core Interfaces

```ts
interface KeyValueStore<T> {
  get(key: string): Promise<KvResult<T>>
  set(key: string, value: T, opts?: { ttl?: { kind: 'milliseconds'; milliseconds: number } }): Promise<void>
  delete(key: string): Promise<void>
  has(key: string): Promise<boolean>
  getMany(keys: readonly string[]): Promise<Map<string, KvResult<T>>>
  setMany(entries: readonly [string, T][]): Promise<void>
  deleteMany(keys: readonly string[]): Promise<void>
}

interface KeyValueStoreCas<T> extends KeyValueStore<T> {
  getVersioned(key: string): Promise<KvResultVersioned<T>>
  setIfVersion(key: string, value: T, expectedVersion: string): Promise<KvCasResult>
}

interface KeyValueStoreConditional<T> extends KeyValueStore<T> {
  setIfNotExists(key: string, value: T): Promise<KvWriteResult>
  setIfExists(key: string, value: T): Promise<KvWriteResult>
}
```

## When To Use Each

`KeyValueStore`
- Caching-adjacent state, lookups, and writes where last-write-wins is acceptable.

`KeyValueStoreCas`
- Read-modify-write with race safety (job claiming, state transitions, counters).

`KeyValueStoreConditional`
- Create-once and claim semantics (idempotency keys, lock tokens, resource reservation).

## Usage

```ts
import {
  createRedisClient,
  createRedisKeyValueStoreCasAndConditional,
  type Codec,
} from "@subspace/kv"

type UploadState = { status: "awaiting_upload" | "queued" | "processing" }

const codec: Codec<UploadState> = {
  encode: (value) => new TextEncoder().encode(JSON.stringify(value)),
  decode: (bytes) => JSON.parse(new TextDecoder().decode(bytes)),
}

const redis = createRedisClient({ url: process.env.REDIS_URL! })
const store = createRedisKeyValueStoreCasAndConditional<UploadState>({
  client: redis,
  codec,
  opts: {
    keyspacePrefix: "uploads",
    batchSize: 500,
  },
})

const versioned = await store.getVersioned("upload:123")
if (versioned.kind === "found") {
  await store.setIfVersion("upload:123", { ...versioned.value, status: "processing" }, versioned.version)
}
```

## Adapters

- [memory](./src/adapters/memory): in-memory KV/CAS/conditional adapters for local dev and tests.
- [redis](./src/adapters/redis): Redis-backed KV/CAS/conditional adapters.

Implementation notes:
- Redis CAS uses atomic scripting in [redis-bytes-kv-cas.ts](./src/adapters/redis/redis-bytes-kv-cas.ts).
- Redis conditional writes are implemented in [redis-bytes-kv-conditional.ts](./src/adapters/redis/redis-bytes-kv-conditional.ts).

## Result Types

Reads are discriminated unions:

```ts
type KvResult<T> =
  | { kind: "found"; value: T }
  | { kind: "not_found" }

type KvResultVersioned<T> =
  | { kind: "found"; value: T; version: string }
  | { kind: "not_found" }
```

Write outcomes are explicit:

```ts
type KvCasResult =
  | { kind: "written"; version: string }
  | { kind: "conflict" }
  | { kind: "not_found" }

type KvWriteResult =
  | { kind: "written" }
  | { kind: "skipped" }
```

Expected control-flow states are returned as values, not thrown exceptions.

## Testing

```bash
pnpm --filter @subspace/kv test
```

Redis adapter tests:

```bash
pnpm --filter @subspace/kv test:up
pnpm --filter @subspace/kv test
pnpm --filter @subspace/kv test:down
```

## See Also

- [image-upload-pipeline example](../../examples/image-upload-pipeline/README.md)
- [Global concepts](../../docs/concepts.md)
