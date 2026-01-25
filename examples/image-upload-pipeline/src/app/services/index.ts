import type { SystemClock } from "@subspace/clock"
import type { RedisBytesClient } from "@subspace/kv"
import type { Logger } from "@subspace/logger"
import type { IRetryExecutor } from "@subspace/retry"
import type { StoragePort } from "@subspace/storage"
import {
  createUploadServices,
  type UploadServices,
} from "../../domains/uploads/composition"
import type { AppConfig } from "../config"
import { createCoreServices } from "./core"
import { createInfraServices } from "./infra"

export type AppServices = {
  // Core
  logger: Logger
  clock: SystemClock
  retryExecutor: IRetryExecutor

  // Infra
  redisClient: RedisBytesClient
  objectStorage: StoragePort

  // Domains
  uploads: UploadServices
}

export async function createDefaultServices(config: AppConfig): Promise<AppServices> {
  const core = createCoreServices(config)
  const infra = createInfraServices(config, core)

  const uploads = createUploadServices(config, core, infra)

  return {
    ...core,
    ...infra,
    uploads,
  }
}
