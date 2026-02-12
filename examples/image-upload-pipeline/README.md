# image-upload-pipeline

## What This Demonstrates

This example shows a full upload pipeline using multiple Subspace primitives for API handling, metadata persistence, object storage, and background processing.

## Architecture Overview

- HTTP API receives upload requests.
- Metadata and job state are persisted.
- Object storage holds uploaded images and derivatives.
- Worker flow handles image processing asynchronously.

## Prerequisites

- Node.js 22+
- pnpm 10+
- Docker (for local dev/test dependencies)

## Environment Setup

- Development env: `.env.development`
- Test env: `.env.test`

## Run

```bash
pnpm --filter @subspace/image-upload-pipeline dev:up
pnpm --filter @subspace/image-upload-pipeline dev
```

## Test

```bash
pnpm --filter @subspace/image-upload-pipeline test:up
pnpm --filter @subspace/image-upload-pipeline test
pnpm --filter @subspace/image-upload-pipeline test:down
```

## Request/Data Flow

1. Client starts upload via API route.
2. Service allocates identifiers and records upload intent.
3. Binary object is written to object storage.
4. Worker processes image and writes derivative artifacts.
5. API exposes current upload/job state.

## Troubleshooting

- Ensure Docker services are running before `dev` or `test` commands.
- Verify environment variables in `.env.development` or `.env.test`.
- Use package-local tests to isolate failures in upload services.

## Related Packages

- `@subspace/server`
- `@subspace/kv`
- `@subspace/storage`
- `@subspace/logger`
- `@subspace/retry`
- `@subspace/lock`
