# @subspace/id

ID generation primitives with branding and codec helpers for type-safe identifiers.

## Core API

- Generators: `nanoid`, `uuidV4`, `uuidV7`, `prefixed(...)`.
- Branding utilities: `Brand`, `IdType`.
- Codec wrapper: `withGenerator(...)`.

## Usage

```ts
import { prefixed, uuidV7, withGenerator } from "@subspace/id"

type UploadId = string & { readonly __brand: "UploadId" }

const UploadId = withGenerator(
  {
    kind: "UploadId",
    parse: (s: string) => s as UploadId,
    is: (v: unknown): v is UploadId => typeof v === "string",
  },
  { generate: () => prefixed<UploadId>("upload", uuidV7).generate() },
)
```

## Adapters

- [nanoid](./src/adapters/nanoid.ts)
- [uuid](./src/adapters/uuid.ts)
- [prefixed](./src/adapters/prefixed.ts)

## Testing

```bash
pnpm --filter @subspace/id test
pnpm --filter @subspace/id build
```

## See Also

- [Global concepts](../../docs/concepts.md)
