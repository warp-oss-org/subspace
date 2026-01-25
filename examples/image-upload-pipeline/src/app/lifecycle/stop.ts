import type { LifecycleHook } from "@subspace/server"
import type { AppConfig } from "../config"
import type { AppServices } from "../services"

export function createStopHooks(
  _config: AppConfig,
  _services: AppServices,
): LifecycleHook[] {
  return []
}

export type CreateStopHooksFn = typeof createStopHooks
