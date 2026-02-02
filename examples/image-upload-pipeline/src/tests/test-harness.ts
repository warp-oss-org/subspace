import type { Milliseconds } from "@subspace/clock"
import { NullLogger } from "@subspace/logger"
import type {
  Application,
  LifecycleHook,
  LifecycleHookContext,
  ServerHandle,
} from "@subspace/server"
import { ensureS3BucketExists } from "@subspace/storage"
import type { AppContext, AppContextOptions } from "../app/create-context"
import { createAppContext } from "../app/create-context"
import { buildServer } from "../server"

export type TestHarnessLifecycle = {
  /** Run start hooks (connect Redis, etc.) without starting HTTP server */
  start: () => Promise<void>

  /** Run stop hooks (disconnect Redis, etc.) */
  stop: () => Promise<void>
}

export type TestHarness = {
  /** Fully built Hono app, ready for app.request() */
  app: Application

  /** App context with config and services */
  ctx: AppContext

  /** Lifecycle hooks for test setup/teardown */
  lifecycle: TestHarnessLifecycle

  /** Start HTTP server on a real port (for true integration tests) */
  listen: () => Promise<ServerHandle>
}

export async function createTestHarness(
  options: AppContextOptions = {
    coreOverrides: { logger: new NullLogger() },
  },
): Promise<TestHarness> {
  const ctx = await createAppContext(options)
  const { server } = buildServer(ctx)
  const lifecycle = createTestHarnessLifecycle(ctx)

  server.build()

  return {
    ctx,
    lifecycle,
    app: server.app,
    listen: () => server.start(),
  }
}

function createTestHarnessLifecycle(ctx: AppContext): TestHarnessLifecycle {
  const DEFAULT_HOOK_BUDGET_MS: Milliseconds = 30000

  const lifecycle: TestHarnessLifecycle = {
    start: async () => {
      const controller = new AbortController()
      const deadline = Date.now() + DEFAULT_HOOK_BUDGET_MS

      const hookCtx: LifecycleHookContext = {
        signal: controller.signal,
        timeRemainingMs: Math.max(0, deadline - Date.now()),
      }

      const allStartHooks = [
        ...ctx.createStartHooks(ctx),
        ...createCustomTestStartHooks(ctx),
      ]

      for (const hook of allStartHooks) {
        await hook.fn(hookCtx)
      }
    },

    stop: async () => {
      const controller = new AbortController()
      const deadline = Date.now() + DEFAULT_HOOK_BUDGET_MS

      const hookCtx: LifecycleHookContext = {
        signal: controller.signal,
        timeRemainingMs: Math.max(0, deadline - Date.now()),
      }

      for (const hook of ctx.createStopHooks(ctx)) {
        await hook.fn(hookCtx)
      }
    },
  }
  return lifecycle
}

function createCustomTestStartHooks(appCtx: AppContext): LifecycleHook[] {
  const hooks: LifecycleHook[] = [
    {
      name: "start:test:ensure-s3-bucket-exists",
      fn: async () => {
        await ensureS3BucketExists(appCtx.infra.s3Client, appCtx.config.s3.bucket)
      },
    },
  ]

  return hooks
}
