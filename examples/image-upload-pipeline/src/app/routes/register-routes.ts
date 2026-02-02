import { type Application, createRouter } from "@subspace/server"
import { createUploadsModule } from "../../domains/uploads"
import type { AppConfig } from "../config"
import type { DomainServices } from "../services"

export type ApiModule = {
  name: string
  register: (app: Application) => void
}

export function registerRoutes(
  app: Application,
  config: AppConfig,
  services: DomainServices,
): void {
  const apiV1Router = createRouter()

  const modules: ApiModule[] = [
    createUploadsModule({ uploads: services.uploads, config }),
  ]

  for (const m of modules) {
    m.register(apiV1Router)
  }

  app.route("/api/v1", apiV1Router)
  app.get("/", (c) => c.text(`Welcome to ${config.logging.serviceName} API`))
}

export type RegisterRoutesFn = typeof registerRoutes
