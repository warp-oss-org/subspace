# @subspace/singleflight

Duplicate suppression for concurrent work: one in-flight execution per key, shared by all waiters.

## Core Interface

Use the port definition as the source of truth:
- [single-flight.ts](./src/ports/single-flight.ts)

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
