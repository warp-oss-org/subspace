# Contributing

## Development loop

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

## Package changes

When adding or changing a package:

- Keep scope narrow and explicit
- Document guarantees and non-goals in that package's README
- Add or update tests close to the changed behavior

## Docs expectations

- Update [docs/packages.md](./packages.md) and [docs/examples.md](./examples.md) indexes when adding entries
- Keep package and example README quickstarts runnable
- Put shared concepts in [docs/](./) instead of duplicating them across READMEs

## Registry and release changes

When changing manifests, registry tooling, release workflows, or CLI distribution:

- keep docs aligned with the real CLI surface
- update [docs/cli.md](./cli.md) when consumer behavior changes
- update [docs/release-runbook.md](./release-runbook.md) when release steps or assets change
- update [docs/security-model.md](./security-model.md) when the trust model changes

For release-pipeline changes, prefer explicit, reviewable behavior over convenience:

- no implicit “latest” tracking
- no registry-provided code execution
- no npm publish path unless a future plan explicitly approves it
