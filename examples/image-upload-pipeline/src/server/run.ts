import { createAppContext } from "../app/create-context"
import { buildServer } from "."

export async function run(): Promise<void> {
  const ctx = await createAppContext()
  const { server } = buildServer(ctx)

  const running = await server.setupProcessHandlers().start()

  ctx.services.logger.info("Server started", {
    port: running.address.port,
    host: running.address.host,
  })
}
