# @subspace/retry

Retry execution engine for transient failures with pluggable policies and observers.

## Core API

- `createRetryExecutor(...)`: executor factory.
- `RetryConfig`: max attempts, delay policy, predicates.
- `ErrorPredicate` and `ResultPredicate`: define retry conditions.
- `RetryObserver`: hook into attempt lifecycle.

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

const result = await retry.execute(fetchData, {
  maxAttempts: 3,
  delay,
})
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
