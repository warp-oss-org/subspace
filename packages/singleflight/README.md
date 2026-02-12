# @subspace/singleflight

Duplicate suppression for concurrent work: one in-flight execution per key.

## Core Interfaces

Use the port definitions as the source of truth:
- [single-flight.ts](./src/ports/single-flight.ts)

## When To Use Each

`run`
- Share one in-flight execution across concurrent callers for the same key.

`tryRun`
- Skip work immediately if an in-flight execution already exists.

`forget`
- Drop key tracking so next call starts a fresh execution.

## Usage

```ts
// Use Singleflight implementations from src/adapters/*.
// In-memory adapter is the default implementation in this package.
```

## Adapters

- [memory-single-flight.ts](./src/adapters/memory/memory-single-flight.ts)

## Testing

```bash
pnpm --filter @subspace/singleflight test
pnpm --filter @subspace/singleflight build
```

## See Also

- [Global concepts](../../docs/concepts.md)
