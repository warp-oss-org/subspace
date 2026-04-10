# @subspace/cache

Byte-oriented cache primitives with codec, eviction, and through-cache building blocks.

## Core Interfaces

Use the port definitions as the source of truth:
- [bytes-cache.ts](./src/ports/bytes-cache.ts)
- [data-cache.ts](./src/ports/data-cache.ts)
- [cache-result.ts](./src/ports/cache-result.ts)
- [cache-options.ts](./src/ports/cache-options.ts)

## When To Use Each

`DataCache`
- Typed cache usage through codecs.

`BytesCache`
- Raw byte-level cache operations.

Core modules (`codec`, `eviction`, `through`)
- Compose behavior like serialization, eviction policy, and read/write-through flows.

## Usage

```ts
import {
  CodecDataCache,
  MemoryBytesCache,
  SystemClock,
  LruMemoryMap,
  type Codec,
} from "@subspace/cache"
```

## Adapters

- [memory](./src/adapters/memory): in-memory cache adapter.
- [redis](./src/adapters/redis): Redis-backed cache adapter.

## Testing

```bash
pnpm --filter @subspace/cache test
pnpm --filter @subspace/cache build
```

Redis adapter tests:

```bash
pnpm --filter @subspace/cache test:up
pnpm --filter @subspace/cache test
pnpm --filter @subspace/cache test:down
```

## See Also

- [Global concepts](../../docs/concepts.md)
