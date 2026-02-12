# @subspace/secrets

Unified secret vault interfaces with cloud and local adapters.

## Core Interfaces

Use the port definitions as the source of truth:
- [secret-vault.ts](./src/ports/secret-vault.ts)

## Adapters

- [aws-secrets-manager](./src/adapters/aws/aws-secrets-manager-vault.ts)
- [aws-ssm](./src/adapters/aws/aws-ssm-vault.ts)
- [gcp-secret-manager](./src/adapters/gcp/gcp-secret-manager-vault.ts)
- [env](./src/adapters/env/env-secret-vault.ts)
- [fs-json](./src/adapters/fs/json-file-secret-vault.ts)
- [memory](./src/adapters/memory/memory-secret-vault.ts)

## Notes

Public root exports are still being finalized. Current implementation and tests live under `src/ports` and `src/adapters`.

## Testing

```bash
pnpm --filter @subspace/secrets test
pnpm --filter @subspace/secrets build
```

Adapter integration tests:

```bash
pnpm --filter @subspace/secrets test:up
pnpm --filter @subspace/secrets test
pnpm --filter @subspace/secrets test:down
```

## See Also

- [Global concepts](../../docs/concepts.md)
