# @subspace/email

Email transport abstractions plus provider adapters (Postmark, SendGrid, SES, SMTP).

## Core Interfaces

- [EmailMessage](./src/ports/message.ts): transport-agnostic email payload.
- [EmailTransport](./src/ports/transport.ts): single `send(message)` contract.
- [SendResult](./src/ports/transport.ts): normalized delivery response.

## Adapters

- [postmark](./src/adapters/postmark/postmark-transport.ts)
- [sendgrid](./src/adapters/sendgrid/sendgrid-transport.ts)
- [ses](./src/adapters/ses/ses-transport.ts)
- [smtp](./src/adapters/smtp/smtp-transport.ts)

## Notes

Public root exports are still being finalized. Current implementation and tests live under `src/ports` and `src/adapters`.

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
