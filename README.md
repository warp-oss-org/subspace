# Subspace

[![codecov](https://codecov.io/gh/warp-oss-org/subspace/branch/main/graph/badge.svg)](https://codecov.io/gh/warp-oss-org/subspace)

Subspace is a backend toolkit built around small, composable primitives.
Each package targets one infrastructure concern (cache, retries, locks, config, secrets, storage, server utilities, and more) with explicit behavior and minimal coupling.

This repository includes:

- Standalone TypeScript packages under `packages/`
- Runnable integration examples under `examples/`
- A scaffolding CLI under `tooling/subspace-cli/` for bringing primitives into services

Subspace is designed for teams that want clear contracts and reusable infrastructure building blocks without adopting a full framework.

This is not a framework.
This is not an ecosystem.
Each package is designed to stand on its own.

## Documentation

- Getting started: [docs/getting-started.md](docs/getting-started.md)
- Concepts: [docs/concepts.md](docs/concepts.md)
- Package index: [docs/packages.md](docs/packages.md)
- Example index: [docs/examples.md](docs/examples.md)
- CLI: [docs/cli.md](docs/cli.md)
- Contributing: [docs/contributing.md](docs/contributing.md)
