# @subspace/storage

## What It Is

`@subspace/storage` provides an object storage abstraction for file/blob operations across local and cloud backends.

## Quickstart

```ts
import {} from "@subspace/storage";
```

Install dependencies and run checks:

```bash
pnpm --filter @subspace/storage test
pnpm --filter @subspace/storage build
```

## Guarantees And Non-Goals

- Guarantees: behavior is defined by explicit contracts and tests.
- Non-goals: framework-level orchestration belongs outside this package.

## Adapters

- [memory-storage](./src/adapters/memory-storage.ts): in-memory storage adapter.
- [fs-storage](./src/adapters/fs-storage.ts): local filesystem storage adapter.
- [s3-storage](./src/adapters/s3-storage.ts): AWS S3 storage adapter.
- [gcs-storage](./src/adapters/gcs-storage.ts): Google Cloud Storage adapter.
- [create](./src/adapters/create.ts): factory helpers for adapter construction.

## Configuration

Describe runtime configuration and required environment variables here.

## Error Model

Document expected error categories, retryability, and caller handling.

## Testing Notes

- Run package tests with `pnpm --filter @subspace/storage test`.
- Add tests for both happy-path and failure semantics when behavior changes.

## Related Docs

- Global concepts: [docs/concepts.md](../../docs/concepts.md)
- Package index: [docs/packages.md](../../docs/packages.md)
- Example index: [docs/examples.md](../../docs/examples.md)
