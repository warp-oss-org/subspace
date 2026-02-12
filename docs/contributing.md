# Contributing

## Development loop

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
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
