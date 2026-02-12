# @subspace/secrets

## What It Is

`@subspace/secrets` provides a unified secret-store interface with cloud and local adapters.

## Quickstart

```ts
import {} from "@subspace/secrets";
```

Install dependencies and run checks:

```bash
pnpm --filter @subspace/secrets test
pnpm --filter @subspace/secrets build
```

## Guarantees And Non-Goals

- Guarantees: behavior is defined by explicit contracts and tests.
- Non-goals: framework-level orchestration belongs outside this package.

## Adapters

- [aws](./src/adapters/aws): AWS Secrets Manager adapter.
- [gcp](./src/adapters/gcp): Google Secret Manager adapter.
- [env](./src/adapters/env): process environment adapter.
- [fs](./src/adapters/fs): filesystem-backed adapter.
- [memory](./src/adapters/memory): in-memory adapter for tests/local use.

## Configuration

Describe runtime configuration and required environment variables here.

## Error Model

Document expected error categories, retryability, and caller handling.

## Testing Notes

- Run package tests with `pnpm --filter @subspace/secrets test`.
- Add tests for both happy-path and failure semantics when behavior changes.

## Related Docs

- Global concepts: [docs/concepts.md](../../docs/concepts.md)
- Package index: [docs/packages.md](../../docs/packages.md)
- Example index: [docs/examples.md](../../docs/examples.md)
