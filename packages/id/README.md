# @subspace/id

## What It Is

`@subspace/id` provides ID generation utilities and type-safe ID codec helpers.

## Quickstart

```ts
import {} from "@subspace/id";
```

Install dependencies and run checks:

```bash
pnpm --filter @subspace/id test
pnpm --filter @subspace/id build
```

## Guarantees And Non-Goals

- Guarantees: behavior is defined by explicit contracts and tests.
- Non-goals: framework-level orchestration belongs outside this package.

## Adapters

- [nanoid](./src/adapters/nanoid.ts): Nano ID generator adapter.
- [uuid](./src/adapters/uuid.ts): UUID v4 and v7 generator adapters.
- [prefixed](./src/adapters/prefixed.ts): prefix-aware ID generator adapter.

## Configuration

Describe runtime configuration and required environment variables here.

## Error Model

Document expected error categories, retryability, and caller handling.

## Testing Notes

- Run package tests with `pnpm --filter @subspace/id test`.
- Add tests for both happy-path and failure semantics when behavior changes.

## Related Docs

- Global concepts: [docs/concepts.md](../../docs/concepts.md)
- Package index: [docs/packages.md](../../docs/packages.md)
- Example index: [docs/examples.md](../../docs/examples.md)
