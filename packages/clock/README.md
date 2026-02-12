# @subspace/clock

Clock abstraction for deterministic time handling in production and tests.

## Core API

- `SystemClock`: real wall clock implementation.
- `FakeClock`: controllable test clock.
- `Clock` interface: `now()`, `nowMs()`, and `sleep(...)` style primitives.

## Usage

```ts
import { SystemClock, FakeClock } from "@subspace/clock"

const clock = new SystemClock()
const now = clock.now()

const testClock = new FakeClock(new Date("2026-01-01T00:00:00.000Z"))
```

## Adapters

- [system-clock](./src/adapters/system-clock.ts)
- [fake-clock](./src/adapters/fake-clock.ts)

## Testing

```bash
pnpm --filter @subspace/clock test
pnpm --filter @subspace/clock build
```

## See Also

- [Global concepts](../../docs/concepts.md)
