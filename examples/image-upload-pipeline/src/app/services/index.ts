import type { SystemClock } from "@subspace/clock"
import type { Logger } from "@subspace/logger"
import type { IRetryExecutor } from "@subspace/retry"
import {
  createUploadServices,
  type UploadServices,
} from "../../domains/uploads/composition"
import type { AppConfig } from "../config"
import { createCoreServices } from "./core"
import type { InfraClients } from "./infra"

export type AppServices = {
  // Core
  logger: Logger
  clock: SystemClock
  retryExecutor: IRetryExecutor

  // Domains
  uploads: UploadServices
}

export async function createDefaultServices(
  config: AppConfig,
  infra: InfraClients,
): Promise<AppServices> {
  const core = createCoreServices(config)

  const uploads = createUploadServices(config, core, infra)

  return {
    ...core,
    ...infra,
    uploads,
  }
}
