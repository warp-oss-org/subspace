import { setTimeout } from "node:timers/promises"
import type { Milliseconds } from "../../ports/time"

export type Sleep = (ms: Milliseconds, signal?: AbortSignal) => Promise<void>

export async function sleep(ms: Milliseconds, signal?: AbortSignal): Promise<void> {
  await setTimeout(ms, { signal })
}
