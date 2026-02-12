# @subspace/logger

## What It Is

`@subspace/logger` provides structured logging interfaces and adapters for console, pino, and no-op logging.

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

- [console](./src/adapters/console): console logger adapter.
- [pino](./src/adapters/pino): Pino-backed logger adapter.
- [null](./src/adapters/null): no-op logger adapter for tests and silencing logs.

## Configuration

Describe runtime configuration and required environment variables here.

## Error Model

Document expected error categories, retryability, and caller handling.

## Testing Notes

- Run package tests with `pnpm --filter @subspace/logger test`.
- Add tests for both happy-path and failure semantics when behavior changes.

## Related Docs

- Global concepts: [docs/concepts.md](../../docs/concepts.md)
- Package index: [docs/packages.md](../../docs/packages.md)
- Example index: [docs/examples.md](../../docs/examples.md)
