import type { Lock, LockKey } from "../ports/lock"
import type { AcquireOptions } from "../ports/options"

export async function withLock<T>(
  lock: Lock,
  key: LockKey,
  fn: () => Promise<T>,
  opts: AcquireOptions,
): Promise<T> {
  const lease = await lock.acquire(key, opts)

  if (!lease) throw new Error(`Failed to acquire lock: ${key}`)

  try {
    return await fn()
  } finally {
    await lease.release()
  }
}

export async function tryWithLock<T>(
  lock: Lock,
  key: LockKey,
  fn: () => Promise<T>,
  opts: AcquireOptions,
): Promise<T | null> {
  const lease = await lock.tryAcquire(key, opts)

  if (!lease) return null

  try {
    return await fn()
  } finally {
    await lease.release()
  }
}
