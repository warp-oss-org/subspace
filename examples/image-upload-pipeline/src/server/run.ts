import { type AppContextOptions, createAppContext } from "../app/create-context"
import { buildServer } from "."

export async function run(options: AppContextOptions = {}): Promise<void> {
  const ctx = await createAppContext(options)
  const { server } = buildServer(ctx)

  const running = await server.setupProcessHandlers().start()

  ctx.services.core.logger.info("Server started", {
    port: running.address.port,
    host: running.address.host,
  })
}
