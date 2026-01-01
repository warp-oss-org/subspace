import type { Milliseconds } from "@subspace/clock"

export interface LifecycleHookContext {
  signal: AbortSignal
  timeRemainingMs: Milliseconds
}

export interface LifecycleHook {
  name: string
  fn: (ctx: LifecycleHookContext) => Promise<void>
}

export interface HookFailure {
  hook: string
  error: unknown
}
