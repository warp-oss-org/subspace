import type { Milliseconds } from "./time"

export type Sleep = (ms: Milliseconds, signal?: AbortSignal) => Promise<void>
