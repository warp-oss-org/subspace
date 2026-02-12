# @subspace/singleflight

## What It Is

`@subspace/singleflight` provides duplicate-suppression primitives so concurrent requests share one in-flight execution.

## Quickstart

```ts
import {} from "@subspace/singleflight";
```

Install dependencies and run checks:

```bash
pnpm --filter @subspace/singleflight test
pnpm --filter @subspace/singleflight build
```

## Guarantees And Non-Goals

- Guarantees: behavior is defined by explicit contracts and tests.
- Non-goals: framework-level orchestration belongs outside this package.

## Adapters

- [memory](./src/adapters/memory): in-memory singleflight coordination adapter.

## Configuration

Describe runtime configuration and required environment variables here.

## Error Model

Document expected error categories, retryability, and caller handling.

## Testing Notes

- Run package tests with `pnpm --filter @subspace/singleflight test`.
- Add tests for both happy-path and failure semantics when behavior changes.

## Related Docs

- Global concepts: [docs/concepts.md](../../docs/concepts.md)
- Package index: [docs/packages.md](../../docs/packages.md)
- Example index: [docs/examples.md](../../docs/examples.md)
