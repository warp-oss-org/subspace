import type { Application } from "@subspace/server"
import { createUploadsModule } from "../domains/uploads"
import type { AppConfig } from "./config"
import type { AppServices } from "./services"

export function registerRoutes(
  app: Application,
  config: AppConfig,
  services: AppServices,
): void {
  app.get("/", (c) => c.text(`Welcome to ${config.logging.serviceName} API`))

  const modules = [createUploadsModule({ uploads: services.uploads })]

  for (const m of modules) {
    m.register(app)
  }
}

export type RegisterRoutesFn = typeof registerRoutes
