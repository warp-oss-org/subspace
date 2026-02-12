# @subspace/clock

## What It Is

`@subspace/clock` provides a clock abstraction for deterministic time handling in production and tests.

## Quickstart

```ts
import {} from "@subspace/clock";
```

Install dependencies and run checks:

```bash
pnpm --filter @subspace/clock test
pnpm --filter @subspace/clock build
```

## Guarantees And Non-Goals

- Guarantees: behavior is defined by explicit contracts and tests.
- Non-goals: framework-level orchestration belongs outside this package.

## Adapters

- [SystemClock](./src/adapters/system-clock.ts): wall-clock time adapter.
- [FakeClock](./src/adapters/fake-clock.ts): controllable test clock adapter.

## Configuration

Describe runtime configuration and required environment variables here.

## Error Model

Document expected error categories, retryability, and caller handling.

## Testing Notes

- Run package tests with `pnpm --filter @subspace/clock test`.
- Add tests for both happy-path and failure semantics when behavior changes.

## Related Docs

- Global concepts: [docs/concepts.md](../../docs/concepts.md)
- Package index: [docs/packages.md](../../docs/packages.md)
- Example index: [docs/examples.md](../../docs/examples.md)
