# CLI

Subspace CLI documentation lives under [tooling/subspace-cli](../tooling/subspace-cli/).

The CLI is designed for source-copy consumption. Internal repos scaffold reviewed source from a pinned registry release and then commit that code into their own repo.

## Entry points

- [CLI README](../tooling/subspace-cli/README.md)
- [Release Runbook](./release-runbook.md)
- [Security Model](./security-model.md)

## Local checks

```bash
pnpm subspace:cli:check
```

## Consumer workflow

```bash
subspace init
subspace list
subspace info kv
subspace add kv --adapter memory
```

Pinned remote registry example:

```bash
export SUBSPACE_REGISTRY_URL="https://github.com/warp-oss-org/subspace/releases/download/registry-v2026.04.10.1/subspace-registry-registry-v2026.04.10.1.tar.gz"
export SUBSPACE_REGISTRY_SHA256="<pinned-archive-sha256>"

subspace list
subspace info kv
subspace add kv --adapter memory
```

Local generated registry example:

```bash
pnpm subspace:registry:build
export SUBSPACE_REGISTRY_DIR="$PWD/tooling/subspace-cli/registry"

subspace list
subspace add errors
```

## Current registry interface

Registry source selection is currently environment-based:

- `SUBSPACE_REGISTRY_DIR`
- `SUBSPACE_REGISTRY_URL`
- `SUBSPACE_REGISTRY_SHA256`
- `SUBSPACE_REGISTRY_CA_FILE`

Explicit `--registry <url-or-path>` flags are deferred and not implemented today.

## Install paths

Recommended install paths:

- GitHub Release binaries for your OS/architecture
- `go install github.com/warp-oss-org/subspace/tooling/subspace-cli@<tag>`

The CLI is not published to npm, so `npx` / `pnpm dlx` are intentionally unsupported.
