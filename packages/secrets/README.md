# @subspace/secrets

Secret vault interfaces with cloud and local adapter implementations.

## Core Interfaces

Use the port definitions as the source of truth:
- [secret-vault.ts](./src/ports/secret-vault.ts)

## When To Use Each

`SecretVault`
- Read/write secret workflows.

`ReadableSecretVault`
- Read-only consumers.

`VersionedSecretVault` / `ListableSecretVault`
- Version history and prefix discovery semantics.

## Usage

```ts
import {
  EnvSecretVault,
  MemorySecretVault,
  type SecretVault,
} from "@subspace/secrets"
```

## Adapters

- [aws-secrets-manager-vault.ts](./src/adapters/aws/aws-secrets-manager-vault.ts)
- [aws-ssm-vault.ts](./src/adapters/aws/aws-ssm-vault.ts)
- [gcp-secret-manager-vault.ts](./src/adapters/gcp/gcp-secret-manager-vault.ts)
- [env-secret-vault.ts](./src/adapters/env/env-secret-vault.ts)
- [json-file-secret-vault.ts](./src/adapters/fs/json-file-secret-vault.ts)
- [memory-secret-vault.ts](./src/adapters/memory/memory-secret-vault.ts)

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
