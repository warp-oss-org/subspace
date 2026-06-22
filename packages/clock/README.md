# @subspace-kit/clock

Clock abstraction for deterministic time handling in production and tests.

## Core Interfaces

Use the port definitions as the source of truth:
- [clock.ts](./src/ports/clock.ts)
- [sleep.ts](./src/ports/sleep.ts)
- [time.ts](./src/ports/time.ts)

## When To Use Each

`SystemClock`
- Real runtime time source.

`FakeClock`
- Deterministic tests and time control.

## Usage

```ts
import { SystemClock, FakeClock } from "@subspace-kit/clock"

const clock = new SystemClock()
const now = clock.now()

const testClock = new FakeClock(new Date("2026-01-01T00:00:00.000Z"))
```

## Adapters

- [system-clock.ts](./src/adapters/system-clock.ts)
- [fake-clock.ts](./src/adapters/fake-clock.ts)

## Testing

```bash
pnpm --filter @subspace-kit/clock test
pnpm --filter @subspace-kit/clock build
```

## See Also

- [Global concepts](../../docs/concepts.md)
