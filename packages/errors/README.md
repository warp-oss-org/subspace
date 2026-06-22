# @subspace-kit/errors

Shared application error model for creation, normalization, and inspection.

## Core Interfaces

Use the port definitions as the source of truth:
- [error.ts](./src/ports/error.ts)

## When To Use Each

`createError`
- Define typed domain error constructors.

`toAppError` / `isAppError`
- Normalize and guard unknown errors at boundaries.

`errorChain`
- Inspect nested causes for logging and mapping.

## Usage

```ts
import { createError, isAppError, toAppError } from "@subspace-kit/errors"

const UploadError = createError("upload_failed")

try {
  throw UploadError({ message: "write failed" })
} catch (err) {
  const appErr = toAppError(err)
  if (isAppError(appErr)) {
    // map to transport-level response
  }
}
```

## Adapters

No external adapter layer. See [core](./src/core) and [ports](./src/ports).

## Testing

```bash
pnpm --filter @subspace-kit/errors test
pnpm --filter @subspace-kit/errors build
```

## See Also

- [Global concepts](../../docs/concepts.md)
