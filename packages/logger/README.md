# @subspace/logger

## What It Is

`@subspace/logger` provides a focused primitive for backend systems.

## Quickstart

```ts
import {} from "@subspace/logger";
```

Install dependencies and run checks:

```bash
pnpm --filter @subspace/logger test
pnpm --filter @subspace/logger build
```

## Guarantees And Non-Goals

- Guarantees: behavior is defined by explicit contracts and tests.
- Non-goals: framework-level orchestration belongs outside this package.

## Adapters

Check package source for adapter implementations under `src/adapters` (if present).

## Configuration

Describe runtime configuration and required environment variables here.

## Error Model

Document expected error categories, retryability, and caller handling.

## Testing Notes

- Run package tests with `pnpm --filter @subspace/logger test`.
- Add tests for both happy-path and failure semantics when behavior changes.

## Related Docs

- Global concepts: `docs/concepts.md`
- Package index: `docs/packages.md`
- Example index: `docs/examples.md`
