# @subspace/config

Composable configuration loading with typed schema validation and layered sources.

## Core API

- `loadConfig(...)`: load and validate config from ordered sources.
- Source adapters: `DotenvSource`, `EnvSource`, `JsonSource`.
- Ports: `ConfigSource`, `IConfig`.

## Usage

```ts
import { DotenvSource, EnvSource, loadConfig } from "@subspace/config"

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
pnpm --filter @subspace/config test
pnpm --filter @subspace/config build
```

## See Also

- [Global concepts](../../docs/concepts.md)
