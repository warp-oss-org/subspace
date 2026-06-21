# @subspace/storage

Object storage abstraction for memory, filesystem, S3, and GCS backends.

## Core Interfaces

Use the port definitions as the source of truth:
- [storage.ts](./src/ports/storage.ts)
- [storage-object.ts](./src/ports/storage-object.ts)
- [storage-options.ts](./src/ports/storage-options.ts)
- [storage-result.ts](./src/ports/storage-result.ts)

## When To Use Each

`StoragePort`
- Adapter-agnostic object storage operations.

`createMemoryStorage` / `createFsStorage`
- Local development and test-friendly storage implementations.

`createS3Storage` / `createGcsStorage`
- Cloud object storage integrations.

## Usage

```ts
import { S3Client } from "@aws-sdk/client-s3"
import { SystemClock } from "@subspace/clock"
import { createS3Storage } from "@subspace/storage/s3"

const s3 = new S3Client({ region: "us-east-1" })
const storage = createS3Storage({
  client: s3,
  clock: new SystemClock(),
  keyspacePrefix: "uploads",
})
```

## Adapters

- [memory-storage.ts](./src/adapters/memory-storage.ts)
- [fs-storage.ts](./src/adapters/fs-storage.ts)
- [s3-storage.ts](./src/adapters/s3-storage.ts)
- [gcs-storage.ts](./src/adapters/gcs-storage.ts)
- [create.ts](./src/adapters/create.ts)

## Testing

```bash
pnpm --filter @subspace/storage test
pnpm --filter @subspace/storage build
```

Cloud adapter integration tests:

```bash
pnpm --filter @subspace/storage test:up
pnpm --filter @subspace/storage test
pnpm --filter @subspace/storage test:down
```

## See Also

- [Global concepts](../../docs/concepts.md)
