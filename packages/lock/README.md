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

## Adapters

- [memory](./src/adapters/memory): in-process lock implementation.
- [postgres](./src/adapters/postgres): advisory lock implementation.
- [redis](./src/adapters/redis): Redis-backed lock implementation.

## Notes

Public root exports are still being finalized. Current implementation and tests live under `src/ports`, `src/core`, and `src/adapters`.

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
