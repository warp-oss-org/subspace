import { serve } from "@hono/node-server"
import type { Logger } from "@subspace/logger"
import type { Application, Closeable } from "../create-server"
import type { ResolvedServerOptions } from "../server-options"

export function listen(
  app: Application,
  config: ResolvedServerOptions,
  logger: Logger,
): Closeable {
  const server = serve({
    fetch: app.fetch,
    port: config.port,
    hostname: config.host,
  })

  logger.info(`Server listening on http://${config.host}:${config.port}`)

  return server
}

export type ListenFn = typeof listen
