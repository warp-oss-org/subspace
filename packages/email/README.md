# @subspace/email

Email transport abstractions with Postmark, SendGrid, SES, and SMTP adapters.

## Core Interfaces

Use the port definitions as the source of truth:
- [address.ts](./src/ports/address.ts)
- [message.ts](./src/ports/message.ts)
- [transport.ts](./src/ports/transport.ts)

## When To Use Each

`EmailTransport`
- Standardize outbound email delivery across providers.

Provider adapters
- Choose based on provider and deployment constraints.

## Usage

```ts
// Use EmailTransport implementations from src/adapters/*.
// See adapter files for provider-specific construction.
```

## Adapters

- [postmark-transport.ts](./src/adapters/postmark/postmark-transport.ts)
- [sendgrid-transport.ts](./src/adapters/sendgrid/sendgrid-transport.ts)
- [ses-transport.ts](./src/adapters/ses/ses-transport.ts)
- [smtp-transport.ts](./src/adapters/smtp/smtp-transport.ts)

## Testing

```bash
pnpm --filter @subspace/email test
pnpm --filter @subspace/email build
```

Provider integration tests:

```bash
pnpm --filter @subspace/email test:up
pnpm --filter @subspace/email test
pnpm --filter @subspace/email test:down
```

## See Also

- [Global concepts](../../docs/concepts.md)
