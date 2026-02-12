# @subspace/storage

Object storage abstraction with local and cloud adapters.

## Core API

- Factory functions: `createMemoryStorage`, `createFsStorage`, `createS3Storage`, `createGcsStorage`.
- Shared interface: `StoragePort`.
- Shared value types: `ObjectRef`, `StorageObject`, `PutOptions`, `ListOptions`, etc.
- Utility export: `ensureS3BucketExists` (test/local bootstrap helper).

## Usage

```ts
import { S3Client, createS3Storage } from "@subspace/storage"
import { SystemClock } from "@subspace/clock"

const s3 = new S3Client({ region: "us-east-1" })
const storage = createS3Storage({
  client: s3,
  clock: new SystemClock(),
  keyspacePrefix: "uploads",
})
```

## Adapters

- [memory](./src/adapters/memory-storage.ts)
- [filesystem](./src/adapters/fs-storage.ts)
- [s3](./src/adapters/s3-storage.ts)
- [gcs](./src/adapters/gcs-storage.ts)
- [factory helpers](./src/adapters/create.ts)

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
