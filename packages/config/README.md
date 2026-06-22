# @subspace-kit/config

Composable config loading with typed schema validation and layered sources.

## Core Interfaces

Use the port definitions as the source of truth:
- [source.ts](./src/ports/source.ts)
- [config.ts](./src/ports/config.ts)

## When To Use Each

`loadConfig`
- Load and validate config from ordered sources.

`DotenvSource` / `EnvSource` / `JsonSource` / `object`
- Choose configuration inputs based on environment and test needs.

## Usage

```ts
import { EnvSource, loadConfig } from "@subspace-kit/config"
import { DotenvSource } from "@subspace-kit/config/dotenv"

const result = await loadConfig({
  schema: mySchema,
  sources: [
    new DotenvSource({ file: ".env.development", required: true }),
    new EnvSource({ env: process.env }),
  ],
  expandEnv: true,
})
```

## Adapters

- [dotenv](./src/adapters/dotenv)
- [env](./src/adapters/env)
- [json](./src/adapters/json)
- [object](./src/adapters/object)

## Testing

```bash
pnpm --filter @subspace-kit/config test
pnpm --filter @subspace-kit/config build
```

## See Also

- [Global concepts](../../docs/concepts.md)
