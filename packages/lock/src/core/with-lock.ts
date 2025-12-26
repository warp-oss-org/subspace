import type { Lock } from "../ports/lock"
import type { AcquireOptions, TryAcquireOptions } from "../ports/options"

export async function tryWithLock<T>(
  lock: Lock,
  key: string,
  fn: () => Promise<T>,
  opts: TryAcquireOptions,
): Promise<T | null> {
  const lease = await lock.tryAcquire(key, opts)

  if (!lease) {
    return null
  }

  try {
    return await fn()
  } finally {
    await lease.release()
  }
}

export async function withLock<T>(
  lock: Lock,
  key: string,
  fn: () => Promise<T>,
  opts: AcquireOptions,
): Promise<T> {
  if (opts.signal?.aborted) {
    throw new Error("Lock acquisition aborted")
  }

  const lease = await lock.acquire(key, opts)
  if (!lease) {
    throw new Error("Failed to acquire lock")
  }

  try {
    return await fn()
  } finally {
    await lease.release()
  }
}
