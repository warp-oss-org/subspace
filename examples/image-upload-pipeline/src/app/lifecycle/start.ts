import type { LifecycleHook } from "@subspace/server"
import type { AppConfig } from "../config"
import type { AppServices } from "../services"

export function createStartHooks(
  _config: AppConfig,
  _services: AppServices,
): LifecycleHook[] {
  return []
}

export type CreateStartHooksFn = typeof createStartHooks
