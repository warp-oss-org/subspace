# @subspace/server

> [!WARNING]
> `@subspace/server` is primarily an internal package. It is intentionally opinionated around our service conventions and is not intended to be a universal server framework for every team.

## What It Is

`@subspace/server` provides HTTP server composition helpers, lifecycle hooks, middleware utilities, and validation error handling.

## Quickstart

```ts
import {} from "@subspace/server";
```

Install dependencies and run checks:

```bash
pnpm --filter @subspace/server test
pnpm --filter @subspace/server build
```

## Guarantees And Non-Goals

- Guarantees: behavior is defined by explicit contracts and tests.
- Non-goals: framework-level orchestration belongs outside this package.

## Adapters

This package currently has no adapter layer; composition is provided via [server](./src/server), [middleware](./src/middleware), and [lifecycle](./src/lifecycle).

## Configuration

Describe runtime configuration and required environment variables here.

## Error Model

Document expected error categories, retryability, and caller handling.

## Testing Notes

- Run package tests with `pnpm --filter @subspace/server test`.
- Add tests for both happy-path and failure semantics when behavior changes.

## Related Docs

- Global concepts: [docs/concepts.md](../../docs/concepts.md)
- Package index: [docs/packages.md](../../docs/packages.md)
- Example index: [docs/examples.md](../../docs/examples.md)
