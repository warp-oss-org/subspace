import { applyOverrides, type DeepPartial } from "@subspace/server"
import { type AppConfig, loadAppConfig } from "./config"
import { type CreateStartHooksFn, createStartHooks } from "./lifecycle/start"
import { type CreateStopHooksFn, createStopHooks } from "./lifecycle/stop"
import { type RegisterRoutesFn, registerRoutes } from "./routes"
import { type AppServices, createDefaultServices } from "./services"

export type AppContextOptions = {
  env?: NodeJS.ProcessEnv
  configOverrides?: DeepPartial<AppConfig>
  serviceOverrides?: DeepPartial<AppServices>
}

export type AppContext = {
  config: AppConfig
  services: AppServices
  registerRoutes: RegisterRoutesFn
  createStartHooks: CreateStartHooksFn
  createStopHooks: CreateStopHooksFn
}

export async function createAppContext(
  options: AppContextOptions = {},
): Promise<AppContext> {
  const config = await loadAppConfig(options.env ?? process.env, options.configOverrides)

  const baseServices = await createDefaultServices(config)
  const services = applyOverrides(baseServices, options.serviceOverrides)

  return {
    config,
    services,
    registerRoutes,
    createStartHooks,
    createStopHooks,
  }
}
