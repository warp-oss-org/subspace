# @subspace-kit/backoff

Composable backoff and jitter primitives for retries, polling, and contention control.

## Core Interfaces

Use the port definitions as the source of truth:
- [delay-policy.ts](./src/ports/delay-policy.ts)
- [jitter-strategy.ts](./src/ports/jitter-strategy.ts)
- [random-source.ts](./src/ports/random-source.ts)

## When To Use Each

`createBackoff`
- Compose a bounded delay policy with optional jitter.

`constant` / `linear` / `exponential`
- Choose the raw delay growth model.

`fullJitter` / `equalJitter` / `decorrelatedJitter`
- Add randomness to reduce synchronized retries.

## Usage

```ts
import { createBackoff, exponential, decorrelatedJitter } from "@subspace-kit/backoff"

const policy = createBackoff({
  delay: exponential({ base: { milliseconds: 100 }, factor: 2 }),
  min: { milliseconds: 100 },
  max: { milliseconds: 10_000 },
  jitter: decorrelatedJitter({ min: { milliseconds: 50 } }),
})

const nextDelay = policy.getDelay(3)
```

## Adapters

- [random.ts](./src/adapters/random.ts): random source used by jitter strategies.

## Testing

```bash
pnpm --filter @subspace-kit/backoff test
pnpm --filter @subspace-kit/backoff build
```

## See Also

- [Global concepts](../../docs/concepts.md)
