# @subspace/logger

Structured logging interfaces and adapters for console, Pino, and no-op logging.

## Core API

- `createPinoLogger(...)`: production structured logger adapter.
- `createConsoleLogger(...)`: lightweight console adapter.
- `createNullLogger(...)` / `NullLogger`: test/no-output adapter.
- Shared types: `Logger`, `LogContext`, `LogLevelName`.

## Usage

```ts
import { createPinoLogger } from "@subspace/logger"

const logger = createPinoLogger(
  {},
  {
    level: "info",
    prettify: false,
  },
)

logger.info("service_started", { port: 4663 })
```

## Adapters

- [console](./src/adapters/console)
- [pino](./src/adapters/pino)
- [null](./src/adapters/null)

## Testing

```bash
pnpm --filter @subspace/logger test
pnpm --filter @subspace/logger build
```

## See Also

- [Global concepts](../../docs/concepts.md)
