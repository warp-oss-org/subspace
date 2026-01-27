import type { LifecycleHook } from "@subspace/server"
import type { AppContext } from "../create-context"

export function createStartHooks(context: AppContext): LifecycleHook[] {
  return [
    {
      name: "start:redis",
      fn: async () => {
        await context.infra.redisClient.connect()
      },
    },
    {
      name: "start:upload:worker",
      fn: async () => {
        await context.services.uploads.worker.start()
      },
    },
  ]
}

export type CreateStartHooksFn = typeof createStartHooks
