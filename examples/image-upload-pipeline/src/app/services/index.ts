import {
  createUploadServices,
  type UploadServices,
} from "../../domains/uploads/composition"
import type { AppConfig } from "../config"
import type { CoreServices } from "./core"
import type { InfraClients } from "./infra"

export type DomainServices = {
  uploads: UploadServices
}

export type AppServices = {
  core: CoreServices
  domains: DomainServices
}

export function createDefaultDomainServices(
  config: AppConfig,
  infra: InfraClients,
  core: CoreServices,
): DomainServices {
  const uploads = createUploadServices(config, core, infra)

  return {
    uploads,
  }
}
