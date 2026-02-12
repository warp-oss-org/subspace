# @subspace/errors

Shared application error model and helpers for consistent error creation, wrapping, and inspection.

## Core API

- `createError(...)`: construct typed app errors.
- `errorChain(...)`: walk nested causes.
- `isAppError(...)`: runtime guard for app error shape.
- `toAppError(...)`: normalize unknown errors.

## Usage

```ts
import { createError, isAppError, toAppError } from "@subspace/errors"

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
pnpm --filter @subspace/errors test
pnpm --filter @subspace/errors build
```

## See Also

- [Global concepts](../../docs/concepts.md)
