import { sleep } from "../../core/polling/sleep"
import type { Lock, LockKey } from "../lock"
import type { LockTtl } from "../options"
import type { Milliseconds } from "../time"

export type LockHarness = {
  name: string
  make: () => Promise<{
    lock: Lock
    close?: () => Promise<void>
  }>
  ttl: () => LockTtl
  defaultTimeoutMs: () => Milliseconds
}

export function describeLockContract(h: LockHarness) {
  describe(`${h.name} (Lock contract)`, () => {
    describe("tryAcquire", () => {
      it("tryAcquire returns a lease and excludes concurrent holders", async () => {
        const { lock, close } = await h.make()

        try {
          const ttl = h.ttl()
          const key: LockKey = "contract:mutex"

          const a = await lock.tryAcquire(key, { ttl })
          expect(a).not.toBeNull()
          expect(a?.key).toBe(key)

          const b = await lock.tryAcquire(key, { ttl })
          expect(b).toBeNull()

          await a!.release()

          const c = await lock.tryAcquire(key, { ttl })
          expect(c).not.toBeNull()

          await c!.release()
        } finally {
          await close?.()
        }
      })

      it("release is idempotent", async () => {
        const { lock, close } = await h.make()

        try {
          const key: LockKey = "contract:idempotent"
          const ttl = h.ttl()

          const lease = await lock.tryAcquire(key, { ttl })
          expect(lease).not.toBeNull()

          await lease!.release()
          await lease!.release()

          const again = await lock.tryAcquire(key, { ttl })
          expect(again).not.toBeNull()

          await again!.release()
        } finally {
          await close?.()
        }
      })

      it("extend returns true while held and false after release", async () => {
        const { lock, close } = await h.make()

        try {
          const key: LockKey = "contract:extend"
          const ttl = h.ttl()

          const lease = await lock.tryAcquire(key, { ttl })
          expect(lease).not.toBeNull()

          const ok1 = await lease!.extend(ttl)
          expect(ok1).toBe(true)

          await lease!.release()

          const ok2 = await lease!.extend(ttl)
          expect(ok2).toBe(false)
        } finally {
          await close?.()
        }
      })

      it("lock auto-releases after TTL expires", async () => {
        const { lock, close } = await h.make()

        try {
          const key: LockKey = "contract:ttl-expiry"
          const shortTtl = { milliseconds: 50 }

          const lease = await lock.tryAcquire(key, { ttl: shortTtl })
          expect(lease).not.toBeNull()

          await sleep(100)

          const another = await lock.tryAcquire(key, { ttl: h.ttl() })
          expect(another).not.toBeNull()
          await another!.release()
        } finally {
          await close?.()
        }
      })

      it("locks on different keys are independent", async () => {
        const { lock, close } = await h.make()

        try {
          const a = await lock.tryAcquire("key:a", { ttl: h.ttl() })
          const b = await lock.tryAcquire("key:b", { ttl: h.ttl() })

          expect(a).not.toBeNull()
          expect(b).not.toBeNull()

          await a!.release()
          await b!.release()
        } finally {
          await close?.()
        }
      })
    })

    describe("acquire", () => {
      it("acquire with timeoutMs=0 behaves like a one-shot attempt", async () => {
        const { lock, close } = await h.make()

        try {
          const key: LockKey = "contract:oneshot"
          const ttl = h.ttl()

          const held = await lock.tryAcquire(key, { ttl })
          expect(held).not.toBeNull()

          const immediate = await lock.acquire(key, {
            ttl,
            timeoutMs: 0,
          })

          expect(immediate).toBeNull()

          await held!.release()
        } finally {
          await close?.()
        }
      })

      it("throws when timeoutMs is Infinity", async () => {
        const { lock, close } = await h.make()

        try {
          await expect(
            lock.acquire("contract:timeout-infinity", {
              ttl: h.ttl(),
              timeoutMs: Infinity,
            }),
          ).rejects.toThrow(/timeoutMs/i)
        } finally {
          await close?.()
        }
      })

      it("throws when timeoutMs is negative", async () => {
        const { lock, close } = await h.make()

        try {
          await expect(
            lock.acquire("contract:timeout-negative", {
              ttl: h.ttl(),
              timeoutMs: -1,
            }),
          ).rejects.toThrow(/timeoutMs/i)
        } finally {
          await close?.()
        }
      })

      it("acquire waits until the lock is released (within timeout)", async () => {
        const { lock, close } = await h.make()

        try {
          const ttl = h.ttl()
          const key: LockKey = "contract:wait" as LockKey

          const held = await lock.tryAcquire(key, { ttl })

          expect(held).not.toBeNull()

          const p = lock.acquire(key, { ttl, timeoutMs: 250 })

          await sleep(40)
          await held!.release()

          const lease = await p
          expect(lease).not.toBeNull()

          await lease!.release()
        } finally {
          await close?.()
        }
      })

      it("acquire returns null when aborted before acquisition", async () => {
        const { lock, close } = await h.make()

        try {
          const ttl = h.ttl()
          const key: LockKey = "contract:abort"

          const held = await lock.tryAcquire(key, { ttl })
          expect(held).not.toBeNull()

          const ac = new AbortController()
          ac.abort()

          const lease = await lock.acquire(key, {
            ttl,
            timeoutMs: 250,
            signal: ac.signal,
          })

          expect(lease).toBeNull()

          await held!.release()
        } finally {
          await close?.()
        }
      })

      it("acquire returns null when timeout elapses", async () => {
        const { lock, close } = await h.make()

        try {
          const ttl = h.ttl()
          const key: LockKey = "contract:timeout"

          const held = await lock.tryAcquire(key, { ttl })
          expect(held).not.toBeNull()

          const lease = await lock.acquire(key, {
            ttl,
            timeoutMs: 50,
          })

          expect(lease).toBeNull()

          await held!.release()
        } finally {
          await close?.()
        }
      })

      it("acquire returns null when aborted mid-wait", async () => {
        const { lock, close } = await h.make()

        try {
          const key: LockKey = "contract:abort-mid"
          const ttl = h.ttl()

          const held = await lock.tryAcquire(key, { ttl })
          expect(held).not.toBeNull()

          const ac = new AbortController()

          const p = lock.acquire(key, {
            ttl,
            timeoutMs: 500,
            signal: ac.signal,
          })

          await sleep(50)
          ac.abort()

          const lease = await p
          expect(lease).toBeNull()

          await held!.release()
        } finally {
          await close?.()
        }
      })

      it("acquire uses defaultTimeoutMs when timeoutMs is omitted", async () => {
        const { lock, close } = await h.make()
        const expectedTimeout = h.defaultTimeoutMs()

        try {
          const key: LockKey = "contract:default-timeout"
          const ttl = h.ttl()

          const held = await lock.tryAcquire(key, { ttl })
          expect(held).not.toBeNull()

          const start = Date.now()
          const lease = await lock.acquire(key, { ttl })
          const elapsed = Date.now() - start

          expect(lease).toBeNull()
          expect(elapsed).toBeGreaterThanOrEqual(expectedTimeout * 0.8)
          expect(elapsed).toBeLessThan(expectedTimeout * 2)

          await held!.release()
        } finally {
          await close?.()
        }
      })
    })
  })
}
