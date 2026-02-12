# @subspace/email

## What It Is

`@subspace/email` provides a focused primitive for backend systems.

## Quickstart

```ts
import {} from "@subspace/email";
```

Install dependencies and run checks:

```bash
pnpm --filter @subspace/email test
pnpm --filter @subspace/email build
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

- Run package tests with `pnpm --filter @subspace/email test`.
- Add tests for both happy-path and failure semantics when behavior changes.

## Related Docs

- Global concepts: [docs/concepts.md](../../docs/concepts.md)
- Package index: [docs/packages.md](../../docs/packages.md)
- Example index: [docs/examples.md](../../docs/examples.md)
