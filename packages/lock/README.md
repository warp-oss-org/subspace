# @subspace/lock

## What It Is

`@subspace/lock` provides distributed locking primitives with lease, polling, and validation utilities.

## Quickstart

```ts
import {} from "@subspace/lock";
```

Install dependencies and run checks:

```bash
pnpm --filter @subspace/lock test
pnpm --filter @subspace/lock build
```

## Guarantees And Non-Goals

- Guarantees: behavior is defined by explicit contracts and tests.
- Non-goals: framework-level orchestration belongs outside this package.

## Adapters

- [memory](./src/adapters/memory): in-memory lock adapter.
- [postgres](./src/adapters/postgres): PostgreSQL-backed lock adapter.
- [redis](./src/adapters/redis): Redis-backed lock adapter.

## Configuration

Describe runtime configuration and required environment variables here.

## Error Model

Document expected error categories, retryability, and caller handling.

## Testing Notes

- Run package tests with `pnpm --filter @subspace/lock test`.
- Add tests for both happy-path and failure semantics when behavior changes.

## Related Docs

- Global concepts: [docs/concepts.md](../../docs/concepts.md)
- Package index: [docs/packages.md](../../docs/packages.md)
- Example index: [docs/examples.md](../../docs/examples.md)
