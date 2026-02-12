# Subspace

[![codecov](https://codecov.io/gh/warp-oss-org/subspace/branch/main/graph/badge.svg)](https://codecov.io/gh/warp-oss-org/subspace)

Backend primitives for TypeScript.
Small packages, explicit behavior, and composable building blocks instead of a full framework.

## Packages

| Package | What it does |
|---------|--------------|
| [`@subspace/backoff`](packages/backoff/README.md) | Backoff strategy and jitter policy primitives |
| [`@subspace/cache`](packages/cache/README.md) | Cache ports/core with memory and Redis adapters |
| [`@subspace/clock`](packages/clock/README.md) | Real and fake clock abstractions |
| [`@subspace/config`](packages/config/README.md) | Layered config loading from dotenv/env/json sources |
| [`@subspace/email`](packages/email/README.md) | Email transport abstractions and provider adapters |
| [`@subspace/errors`](packages/errors/README.md) | Shared app error types and helpers |
| [`@subspace/id`](packages/id/README.md) | ID generators, branding, and ID codecs |
| [`@subspace/kv`](packages/kv/README.md) | Key-value storage with CAS and conditional writes |
| [`@subspace/lock`](packages/lock/README.md) | Lock interfaces plus memory/Redis/Postgres adapters |
| [`@subspace/logger`](packages/logger/README.md) | Structured logger interfaces and adapters |
| [`@subspace/retry`](packages/retry/README.md) | Retry executor with configurable predicates and delays |
| [`@subspace/secrets`](packages/secrets/README.md) | Secret-vault interfaces with cloud/local adapters |
| [`@subspace/server`](packages/server/README.md) | Opinionated server composition utilities |
| [`@subspace/singleflight`](packages/singleflight/README.md) | In-flight request deduplication by key |
| [`@subspace/storage`](packages/storage/README.md) | Object storage abstraction (memory/fs/S3/GCS) |

Each package is independent. Use one, use several, or use none together.

## Quick Example

```ts
import {
  createRedisClient,
  createRedisKeyValueStoreCasAndConditional,
  type Codec,
} from "@subspace/kv"

type Job = { status: "pending" | "running" | "done" }

const codec: Codec<Job> = {
  encode: (value) => new TextEncoder().encode(JSON.stringify(value)),
  decode: (bytes) => JSON.parse(new TextDecoder().decode(bytes)),
}

const redis = createRedisClient({ url: process.env.REDIS_URL! })
const store = createRedisKeyValueStoreCasAndConditional<Job>({
  client: redis,
  codec,
  opts: { keyspacePrefix: "jobs", batchSize: 500 },
})

const current = await store.getVersioned("job:123")
if (current.kind === "found" && current.value.status === "pending") {
  await store.setIfVersion("job:123", { ...current.value, status: "running" }, current.version)
}
```

## Examples

Full working applications showing how packages compose:

| Example | Demonstrates |
|---------|--------------|
| [`image-upload-pipeline`](examples/image-upload-pipeline) | Presigned uploads, async workers, CAS job claiming |

```bash
# Run an example
pnpm --filter @subspace/image-upload-pipeline dev:up
pnpm --filter @subspace/image-upload-pipeline dev
```

## Install

```bash
pnpm install
```

For package-specific usage, start from the package README in `packages/*/README.md`.

## Development

```bash
pnpm install
pnpm build
pnpm test
```

Requires Node 22+, pnpm 10+, Docker (for integration tests).

## Documentation

| Doc | Contents |
|-----|----------|
| [Getting Started](docs/getting-started.md) | First project setup |
| [Concepts](docs/concepts.md) | Design principles, patterns |
| [Packages](docs/packages.md) | Full package reference |
| [Examples](docs/examples.md) | Annotated example walkthroughs |
| [CLI](docs/cli.md) | Scaffolding tool usage |
| [Contributing](docs/contributing.md) | Development workflow |
