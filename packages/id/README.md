# @subspace-kit/id

ID generation utilities with branding and codec helpers.

## Core Interfaces

Use the port definitions as the source of truth:
- [id-generator.ts](./src/ports/id-generator.ts)

## When To Use Each

`nanoid` / `uuidV4` / `uuidV7`
- Base ID generators.

`prefixed`
- Add semantic prefixes to generated IDs.

`withGenerator`
- Build strongly typed ID wrappers for domain models.

## Usage

```ts
import { prefixed, uuidV7, withGenerator } from "@subspace-kit/id"

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

- [nanoid.ts](./src/adapters/nanoid.ts)
- [uuid.ts](./src/adapters/uuid.ts)
- [prefixed.ts](./src/adapters/prefixed.ts)

## Testing

```bash
pnpm --filter @subspace-kit/id test
pnpm --filter @subspace-kit/id build
```

## See Also

- [Global concepts](../../docs/concepts.md)
