# @subspace/singleflight

Duplicate suppression for concurrent work: one in-flight execution per key, shared by all waiters.

## Core Interface

[Singleflight](./src/ports/single-flight.ts) defines:
- `run(key, fn)`: deduplicate concurrent calls by key.
- `tryRun(key, fn)`: return immediately if a call is already in flight.
- `forget(key)`: clear key tracking for future calls.
- Result metadata includes leader/follower source and sharing counts.

## Adapter

- [memory](./src/adapters/memory/memory-single-flight.ts): in-memory singleflight group.

## Notes

Public root exports are still being finalized. Current implementation and tests live under `src/ports` and `src/adapters`.

## Testing

```bash
pnpm --filter @subspace/singleflight test
pnpm --filter @subspace/singleflight build
```

## See Also

- [Global concepts](../../docs/concepts.md)
