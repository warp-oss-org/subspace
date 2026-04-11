# Subspace

[![codecov](https://codecov.io/gh/warp-oss-org/subspace/branch/main/graph/badge.svg)](https://codecov.io/gh/warp-oss-org/subspace)

Backend primitives for TypeScript.
Small packages, explicit behavior, and composable building blocks instead of a full framework.

Subspace is distributed in two ways:

- package source under [`packages/`](./packages/) for local development inside this repo
- a pinned source-copy registry plus CLI release assets for internal consumer repos

Subspace is not currently distributed as npm/GitHub Packages for internal consumption. Consumer repos should scaffold reviewed source from a pinned registry release, commit the copied code, and own it from there.

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
import { createRetryExecutor } from "@subspace/retry"
import { createBackoff, exponential } from "@subspace/backoff"
import { SystemClock } from "@subspace/clock"

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
pnpm --filter @subspace/image-upload-pipeline dev:up
pnpm --filter @subspace/image-upload-pipeline dev
```

## Install

```bash
pnpm install
```

For package-specific usage inside this repo, start from the package README in `packages/*/README.md`.

For internal consumer repos, use the CLI and a pinned registry release instead of installing `@subspace/*` from a package registry.

## Internal Consumption

Recommended flow for an internal project:

1. Install `subspace` from a GitHub Release asset or via `go install`.
2. Choose a pinned registry release tag and checksum.
3. Scaffold the primitive from that pinned registry.
4. Review the generated diff.
5. Commit the copied source into the consumer repo.

Example with a pinned remote registry:

```bash
subspace init

export SUBSPACE_REGISTRY_URL="https://github.com/warp-oss-org/subspace/releases/download/registry-v2026.04.10.1/subspace-registry-registry-v2026.04.10.1.tar.gz"
export SUBSPACE_REGISTRY_SHA256="<pinned-archive-sha256>"

subspace list
subspace info kv
subspace add kv --adapter memory
```

The CLI does not auto-install dependencies or execute registry-provided commands. Consumers should review the generated diff and add runtime dependencies explicitly.

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

Requires Node 22+, pnpm 10+, Docker (for integration tests and service-backed test runs).

## Documentation

| Doc | Contents |
|-----|----------|
| [Getting Started](docs/getting-started.md) | First project setup |
| [Concepts](docs/concepts.md) | Design principles, patterns |
| [Packages](docs/packages.md) | Full package reference |
| [Examples](docs/examples.md) | Annotated example walkthroughs |
| [CLI](docs/cli.md) | Scaffolding tool usage |
| [Contributing](docs/contributing.md) | Development workflow |
| [Release Runbook](docs/release-runbook.md) | How to cut a registry release |
| [Security Model](docs/security-model.md) | Registry trust and threat model |
