# Subspace

[![codecov](https://codecov.io/gh/warp-oss-org/subspace/branch/main/graph/badge.svg)](https://codecov.io/gh/warp-oss-org/subspace)

Backend primitives for TypeScript.
Small packages, explicit behavior, and composable building blocks instead of a full framework.

Subspace is distributed in two ways:

- package source under [`packages/`](./packages/) for local development inside this repo
- the `subspace` CLI release for internal consumer repos

Consumer repos install the `subspace` CLI, scaffold reviewed source from the embedded registry, commit the copied code, and own it from there.

## Packages

| Package | What it does |
|---------|--------------|
| [`@subspace-kit/backoff`](packages/backoff/README.md) | Backoff strategy and jitter policy primitives |
| [`@subspace-kit/cache`](packages/cache/README.md) | Cache ports/core with memory and Redis adapters |
| [`@subspace-kit/clock`](packages/clock/README.md) | Real and fake clock abstractions |
| [`@subspace-kit/config`](packages/config/README.md) | Layered config loading from dotenv/env/json sources |
| [`@subspace-kit/email`](packages/email/README.md) | Email transport abstractions and provider adapters |
| [`@subspace-kit/errors`](packages/errors/README.md) | Shared app error types and helpers |
| [`@subspace-kit/id`](packages/id/README.md) | ID generators, branding, and ID codecs |
| [`@subspace-kit/kv`](packages/kv/README.md) | Key-value storage with CAS and conditional writes |
| [`@subspace-kit/lock`](packages/lock/README.md) | Lock interfaces plus memory/Redis/Postgres adapters |
| [`@subspace-kit/logger`](packages/logger/README.md) | Structured logger interfaces and adapters |
| [`@subspace-kit/retry`](packages/retry/README.md) | Retry executor with configurable predicates and delays |
| [`@subspace-kit/secrets`](packages/secrets/README.md) | Secret-vault interfaces with cloud/local adapters |
| [`@subspace-kit/server`](packages/server/README.md) | Opinionated server composition utilities |
| [`@subspace-kit/singleflight`](packages/singleflight/README.md) | In-flight request deduplication by key |
| [`@subspace-kit/storage`](packages/storage/README.md) | Object storage abstraction (memory/fs/S3/GCS) |

Each package is independent. Use one, use several, or use none together.

## Quick Example

```ts
import { createRetryExecutor } from "@subspace-kit/retry"
import { createBackoff, exponential } from "@subspace-kit/backoff"
import { SystemClock } from "@subspace-kit/clock"

const retry = createRetryExecutor({ clock: new SystemClock() })
const delay = createBackoff({
  delay: exponential({ base: { milliseconds: 100 }, factor: 2 }),
  min: { milliseconds: 100 },
  max: { milliseconds: 2_000 },
})

async function getUserWithRetry(id: string) {
  return retry.execute(
    () => fetch(`https://api.example.com/users/${id}`).then((r) => r.json()),
    { maxAttempts: 3, delay },
  )
}
```

For a production-style composition example (KV + storage + worker + server), see [image-upload-pipeline](examples/image-upload-pipeline/README.md).

## Examples

Full working applications showing how packages compose:

| Example | Demonstrates |
|---------|--------------|
| [`image-upload-pipeline`](examples/image-upload-pipeline) | Presigned uploads, async workers, CAS job claiming |

```bash
# Run an example
pnpm --filter @subspace-kit/image-upload-pipeline dev:up
pnpm --filter @subspace-kit/image-upload-pipeline dev
```

## Install

```bash
pnpm install
```

For package-specific usage inside this repo, start from the package README in `packages/*/README.md`.

For internal consumer repos, use the CLI release and review the generated source.

## Internal Consumption

Recommended flow for an internal project:

1. Install `subspace` from a GitHub Release asset or via `go install`.
2. Scaffold the primitive from the embedded registry.
4. Review the generated diff.
5. Commit the copied source into the consumer repo.

Example:

```bash
subspace version
subspace update
subspace init
subspace list
subspace info kv
subspace add kv --adapter memory
```

The CLI uses the registry embedded in the installed binary. Consumers should review the generated diff and add runtime dependencies explicitly.

## Development

Install dependencies:

```bash
pnpm install
```

Run static checks:

```bash
pnpm lint
pnpm typecheck
pnpm -r run build
```

Run package tests:

```bash
pnpm test:up
pnpm test:coverage
pnpm test:down
```

Run CLI tests:

```bash
pnpm subspace:cli:test
```

Requires Node 22+, pnpm 11+, Docker (for integration tests and service-backed test runs).

## Documentation

| Doc | Contents |
|-----|----------|
| [Getting Started](docs/getting-started.md) | First project setup |
| [Concepts](docs/concepts.md) | Design principles, patterns |
| [Packages](docs/packages.md) | Full package reference |
| [Examples](docs/examples.md) | Annotated example walkthroughs |
| [CLI](docs/cli.md) | Scaffolding tool usage |
| [Contributing](docs/contributing.md) | Development workflow |
| [Release Runbook](docs/release-runbook.md) | How to cut a Subspace CLI release |
| [Security Model](docs/security-model.md) | CLI release trust and threat model |
