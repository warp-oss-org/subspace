# @subspace/errors

## What It Is

`@subspace/errors` provides shared error types and utilities for building consistent application error chains.

## Quickstart

```ts
import {} from "@subspace/errors";
```

Install dependencies and run checks:

```bash
pnpm --filter @subspace/errors test
pnpm --filter @subspace/errors build
```

## Guarantees And Non-Goals

- Guarantees: behavior is defined by explicit contracts and tests.
- Non-goals: framework-level orchestration belongs outside this package.

## Adapters

This package currently has no external adapters. See [core](./src/core) and [ports](./src/ports).

## Configuration

Describe runtime configuration and required environment variables here.

## Error Model

Document expected error categories, retryability, and caller handling.

## Testing Notes

- Run package tests with `pnpm --filter @subspace/errors test`.
- Add tests for both happy-path and failure semantics when behavior changes.

## Related Docs

- Global concepts: [docs/concepts.md](../../docs/concepts.md)
- Package index: [docs/packages.md](../../docs/packages.md)
- Example index: [docs/examples.md](../../docs/examples.md)
