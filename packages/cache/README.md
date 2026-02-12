# @subspace/cache

Byte-oriented caching primitives with codec layers, eviction policies, and memory/Redis adapters.

## Scope

This package defines core cache ports and implementation building blocks under:

- [ports](./src/ports)
- [core](./src/core)
- [adapters](./src/adapters)

## Adapters

- [memory](./src/adapters/memory): in-memory cache adapter.
- [redis](./src/adapters/redis): Redis-backed cache adapter.

## Notes

The root barrel in [src/index.ts](./src/index.ts) is currently minimal. Most integration points are in the adapter/core modules directly while API surfacing is being finalized.

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
