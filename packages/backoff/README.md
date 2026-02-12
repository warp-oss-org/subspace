# @subspace/backoff

Composable backoff strategies and jitter policies for retries, polling loops, and contention control.

## Core API

- `createBackoff(...)`: creates a `DelayPolicy` with min/max bounds and jitter.
- Strategies: `constant(...)`, `linear(...)`, `exponential(...)`.
- Jitter: `fullJitter(...)`, `equalJitter(...)`, `decorrelatedJitter(...)`.
- `RandomSource`: pluggable randomness for deterministic tests.

## Usage

```ts
import { createBackoff, exponential, decorrelatedJitter } from "@subspace/backoff"

const policy = createBackoff({
  delay: exponential({ base: { milliseconds: 100 }, factor: 2 }),
  min: { milliseconds: 100 },
  max: { milliseconds: 10_000 },
  jitter: decorrelatedJitter({ min: { milliseconds: 50 } }),
})

const next = policy.getDelay(3)
```

## Adapters

- [random](./src/adapters/random.ts): default random source used by jitter strategies.

## Testing

```bash
pnpm --filter @subspace/backoff test
pnpm --filter @subspace/backoff build
```

## See Also

- [Global concepts](../../docs/concepts.md)
