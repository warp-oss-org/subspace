import { serve } from "@hono/node-server"
import type { Logger } from "@subspace/logger"
import type { Hono } from "hono"
import type { ResolvedServerConfig } from "../config"
import type { Closeable } from "../server"

export function bindServer(
  app: Hono,
  config: ResolvedServerConfig,
  logger: Logger,
): Closeable {
  const server = serve({
    fetch: app.fetch,
    port: config.port,
    hostname: config.host,
  })

  logger.info(`Server listening on ${config.host}:${config.port}`)

  return server
}
