# @subspace/kv

## What It Is

`@subspace/kv` provides a key-value store abstraction with optional CAS and conditional write semantics.

## Quickstart

```ts
import {} from "@subspace/kv";
```

Install dependencies and run checks:

```bash
pnpm --filter @subspace/kv test
pnpm --filter @subspace/kv build
```

## Guarantees And Non-Goals

- Guarantees: behavior is defined by explicit contracts and tests.
- Non-goals: framework-level orchestration belongs outside this package.

## Adapters

- [memory](./src/adapters/memory): in-memory key-value adapter.
- [redis](./src/adapters/redis): Redis-backed key-value adapter.

## Configuration

Describe runtime configuration and required environment variables here.

## Error Model

Document expected error categories, retryability, and caller handling.

## Testing Notes

- Run package tests with `pnpm --filter @subspace/kv test`.
- Add tests for both happy-path and failure semantics when behavior changes.

## Related Docs

- Global concepts: [docs/concepts.md](../../docs/concepts.md)
- Package index: [docs/packages.md](../../docs/packages.md)
- Example index: [docs/examples.md](../../docs/examples.md)
