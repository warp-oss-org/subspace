# Getting Started

Subspace is a collection of focused backend primitives. Use only the pieces you need.

For internal consumers, the recommended path is source-copy scaffolding from the installed `subspace` CLI, not npm package installation.

## Prerequisites

- Node.js 22+
- pnpm 10+

## Install

```bash
pnpm install
```

That installs this repo for local development. For an internal consumer repo, install the `subspace` CLI from GitHub Releases, then scaffold a primitive from the embedded registry.

## Run checks

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

## Explore packages

- Package index: [docs/packages.md](./packages.md)
- Example index: [docs/examples.md](./examples.md)
- Core concepts: [docs/concepts.md](./concepts.md)
- CLI notes: [docs/cli.md](./cli.md)
- Release process: [docs/release-runbook.md](./release-runbook.md)
- Security posture: [docs/security-model.md](./security-model.md)
