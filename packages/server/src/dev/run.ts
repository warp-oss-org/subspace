import { SystemClock } from "@subspace/clock"
import type { Logger } from "@subspace/logger"
import { PinoLogger } from "../../../logger/src/adapters/pino/pino-logger"
import { createServer } from "../server"
import type { ServerOptions } from "../server/server-options"

export async function run(): Promise<void> {
  const clock = new SystemClock()
  const logger: Logger = new PinoLogger(
    {},
    { level: "debug", prettify: true },
    { service: "smoke-server" },
  )

  const options: ServerOptions = {
    port: 4663,
    errorHandling: { kind: "mappings", config: { mappings: {} } },
    requestId: { enabled: true, header: "x-request-id", fallbackToTraceparent: false },
    requestLogging: { enabled: true, level: "info" },
    clientIp: { enabled: true, trustedProxies: 0 },

    routes: (app) => {
      app.get("/", (c) => {
        const requestId = c.get("requestId") ?? "unknown"
        const ip = c.get("clientIp") ?? c.get("remoteIp") ?? "unknown"
        const reqLogger = c.get("logger") ?? logger

        reqLogger.info("hello route hit", { requestId, ip })

        return c.json({ ok: true, requestId, ip })
      })
    },

    startHooks: [
      {
        name: "startup:smoke",
        fn: async () => {
          logger.info("startup hook: ok")
        },
      },
    ],
    stopHooks: [
      {
        name: "stop:smoke",
        fn: async () => {
          logger.info("stop hook: ok")
        },
      },
    ],
  }

  const server = createServer({ logger, clock }, options)

  const running = await server.setupProcessHandlers().start()

  logger.info("smoke server started", running.address)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
}
