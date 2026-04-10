# @subspace/lock

Distributed lock primitives for critical sections with lease semantics.

## Core Interfaces

Use the port definitions as the source of truth:
- [lock.ts](./src/ports/lock.ts)
- [lock-lease.ts](./src/ports/lock-lease.ts)
- [options.ts](./src/ports/options.ts)
- [time.ts](./src/ports/time.ts)

Helper utilities:
- [with-lock.ts](./src/core/with-lock.ts)

## When To Use Each

`lock.acquire`
- Block/wait until lock is acquired.

`lock.tryAcquire`
- Fast-fail lock attempt when contention is expected.

`withLock` / `tryWithLock`
- Wrap critical sections with automatic release.

## Usage

```ts
import {
  MemoryLock,
  SystemClock,
  pollUntil,
  sleep,
  withLock,
} from "@subspace/lock"
```

## Adapters

- [memory](./src/adapters/memory): in-process lock implementation.
- [postgres](./src/adapters/postgres): advisory lock implementation.
- [redis](./src/adapters/redis): Redis-backed lock implementation.

## Testing

```bash
pnpm --filter @subspace/lock test
pnpm --filter @subspace/lock build
```

Adapter integration tests:

```bash
pnpm --filter @subspace/lock test:up
pnpm --filter @subspace/lock test
pnpm --filter @subspace/lock test:down
```

## See Also

- [Global concepts](../../docs/concepts.md)
