# @subspace/logger

Structured logging interfaces with console, pino, and null adapters.

## Core Interfaces

Use the port definitions as the source of truth:
- [logger.ts](./src/ports/logger.ts)
- [log-context.ts](./src/ports/log-context.ts)
- [log-level.ts](./src/ports/log-level.ts)
- [logger-options.ts](./src/ports/logger-options.ts)

## When To Use Each

`createPinoLogger`
- Production structured logging.

`createConsoleLogger`
- Lightweight local/dev logging.

`createNullLogger`
- Silent logger for tests and no-op environments.

## Usage

```ts
import { createPinoLogger } from "@subspace/logger"

const logger = createPinoLogger({}, { level: "info", prettify: false })
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
