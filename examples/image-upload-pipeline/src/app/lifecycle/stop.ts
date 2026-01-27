import type { LifecycleHook } from "@subspace/server"
import type { AppContext } from "../create-context"

export function createStopHooks(context: AppContext): LifecycleHook[] {
  return [
    {
      name: "stop:redis",
      fn: async () => {
        await context.infra.redisClient.quit()
      },
    },
    {
      name: "stop:upload:worker",
      fn: async () => {
        await context.services.uploads.worker.stop()
      },
    },
  ]
}

export type CreateStopHooksFn = typeof createStopHooks
