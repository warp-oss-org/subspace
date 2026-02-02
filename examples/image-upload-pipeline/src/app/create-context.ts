import path from "node:path"
import { applyOverrides, type DeepPartial } from "@subspace/server"
import { type AppConfig, loadAppConfig } from "./config"
import { type CreateStartHooksFn, createStartHooks } from "./lifecycle/start"
import { type CreateStopHooksFn, createStopHooks } from "./lifecycle/stop"
import { type RegisterRoutesFn, registerRoutes } from "./routes"
import {
  type AppServices,
  createDefaultDomainServices,
  type DomainServices,
} from "./services"
import { type CoreServices, createCoreServices } from "./services/core"
import { createDefaultInfraClients, type InfraClients } from "./services/infra"

export type AppContextOptions = {
  env?: NodeJS.ProcessEnv
  configOverrides?: DeepPartial<AppConfig>
  infraOverrides?: DeepPartial<InfraClients>
  coreOverrides?: DeepPartial<CoreServices>
  domainOverrides?: DeepPartial<DomainServices>
}

export type AppContext = {
  config: AppConfig
  infra: InfraClients
  services: AppServices
  registerRoutes: RegisterRoutesFn
  createStartHooks: CreateStartHooksFn
  createStopHooks: CreateStopHooksFn
}

export async function createAppContext(
  options: AppContextOptions = {},
): Promise<AppContext> {
  const projectRoot = path.resolve(__dirname, "..", "..")

  const config = await loadAppConfig(
    options.env ?? process.env,
    options.configOverrides,
    projectRoot,
  )

  const baseInfra = createDefaultInfraClients(config)
  const infra = applyOverrides(baseInfra, options.infraOverrides)

  const baseCore = createCoreServices(config)
  const core = applyOverrides(baseCore, options.coreOverrides)

  const baseDomains = createDefaultDomainServices(config, infra, core)
  const domains = applyOverrides(baseDomains, options.domainOverrides)

  // !! TODO: Nesting here is questionable, revisit later.
  const services = { core, domains }

  return {
    config,
    infra,
    services,
    registerRoutes,
    createStartHooks,
    createStopHooks,
  }
}
