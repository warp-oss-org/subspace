export {
  MemoryLock,
  type MemoryLockConfig,
  type MemoryLockDeps,
} from "./adapters/memory/memory-lock"
export {
  type PollDeps,
  type PollOptions,
  type PollUntilFailure,
  type PollUntilFn,
  type PollUntilResult,
  type PollUntilSuccess,
  pollUntil,
} from "./core/polling/poll-until"
export { type Sleep, sleep } from "./core/polling/sleep"
export { type Clock, SystemClock } from "./core/time/clock"
export { tryWithLock, withLock } from "./core/with-lock"
export type { Lock, LockKey } from "./ports/lock"
export type { LockLease } from "./ports/lock-lease"
export type {
  AcquireOptions,
  LockConfig,
  LockTtl,
  MillisecondsTtl,
  TryAcquireOptions,
} from "./ports/options"
export type { Milliseconds, Seconds } from "./ports/time"
