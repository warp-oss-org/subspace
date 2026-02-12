# @subspace/server

> [!WARNING]
> `@subspace/server` is primarily an internal package. It is intentionally opinionated around our service conventions and is not intended to be a universal server framework for every team.

HTTP server composition utilities with lifecycle hooks, middleware wiring, and error mapping.

## Core API

- `createServer(...)`: compose app, middleware, routes, hooks, and runtime behavior.
- `createRouter(...)`: build modular route groups.
- `parseOrThrow(...)`, `ValidationError`, `isValidationError(...)`: request parsing and validation support.
- `LifecycleHook` + `LifecycleHookContext`: startup/shutdown hook contracts.
- `applyOverrides(...)`: deep partial config override helper.

## Usage

```ts
import { createServer, createRouter, type Application } from "@subspace/server"

const server = createServer(
  { clock, logger },
  {
    host: "0.0.0.0",
    port: 4663,
    routes: (app: Application) => {
      const api = createRouter()
      api.get("/health", (c) => c.json({ ok: true }))
      app.route("/api/v1", api)
    },
  },
)

await server.setupProcessHandlers().start()
```

## Adapters

No dedicated `src/adapters` layer. Composition is organized under:
- [server](./src/server)
- [middleware](./src/middleware)
- [lifecycle](./src/lifecycle)
- [errors](./src/errors)

## Testing

```bash
pnpm --filter @subspace/server test
pnpm --filter @subspace/server build
```

## See Also

- [Global concepts](../../docs/concepts.md)
