# @subspace/config

## What It Is

`@subspace/config` provides composable configuration sources and typed loading helpers for application config.

## Quickstart

```ts
import {} from "@subspace/config";
```

Install dependencies and run checks:

```bash
pnpm --filter @subspace/config test
pnpm --filter @subspace/config build
```

## Guarantees And Non-Goals

- Guarantees: behavior is defined by explicit contracts and tests.
- Non-goals: framework-level orchestration belongs outside this package.

## Adapters

- [dotenv](./src/adapters/dotenv): loads key-value config from dotenv files.
- [env](./src/adapters/env): reads config from process environment variables.
- [json](./src/adapters/json): reads config from JSON sources.
- [object](./src/adapters/object): in-memory object config source.

## Configuration

Describe runtime configuration and required environment variables here.

## Error Model

Document expected error categories, retryability, and caller handling.

## Testing Notes

- Run package tests with `pnpm --filter @subspace/config test`.
- Add tests for both happy-path and failure semantics when behavior changes.

## Related Docs

- Global concepts: [docs/concepts.md](../../docs/concepts.md)
- Package index: [docs/packages.md](../../docs/packages.md)
- Example index: [docs/examples.md](../../docs/examples.md)
