# CLI

Subspace CLI documentation lives under [tooling/subspace-cli](../tooling/subspace-cli/).

The CLI is designed for source-copy consumption. Internal repos scaffold reviewed source from the CLI's embedded registry and then commit that code into their own repo.

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
subspace version
subspace update
subspace init
subspace list
subspace info kv
subspace add kv --adapter memory
```

`subspace update --to <tag>` installs an explicit CLI release. The embedded registry updates with the binary.

## Install paths

Recommended install paths:

- GitHub Release binaries for your OS/architecture

The CLI is not published to npm, so `npx` / `pnpm dlx` are intentionally unsupported.
