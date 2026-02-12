# @subspace/retry

Retry execution engine for transient failures with configurable delay/predicate behavior.

## Core Interfaces

Use the port definitions as the source of truth:
- [retry-executor.ts](./src/ports/retry-executor.ts)
- [retry-config.ts](./src/ports/retry-config.ts)
- [retry-result.ts](./src/ports/retry-result.ts)
- [predicates.ts](./src/ports/predicates.ts)
- [observer.ts](./src/ports/observer.ts)

## When To Use Each

`execute`
- Throwing mode when retries are exhausted.

`tryExecute`
- Result-wrapper mode when callers need explicit success/failure envelopes.

Predicates and observers
- Tune retry behavior and capture attempt telemetry.

## Usage

```ts
import { createRetryExecutor } from "@subspace/retry"
import { SystemClock } from "@subspace/clock"
import { createBackoff, exponential } from "@subspace/backoff"

const retry = createRetryExecutor({ clock: new SystemClock() })
const delay = createBackoff({
  delay: exponential({ base: { milliseconds: 100 }, factor: 2 }),
  min: { milliseconds: 100 },
  max: { milliseconds: 5_000 },
})

await retry.execute(fetchData, { maxAttempts: 3, delay })
```

## Adapters

No external adapter layer. See [core](./src/core) and [ports](./src/ports).

## Testing

```bash
pnpm --filter @subspace/retry test
pnpm --filter @subspace/retry build
```

## See Also

- [Global concepts](../../docs/concepts.md)
