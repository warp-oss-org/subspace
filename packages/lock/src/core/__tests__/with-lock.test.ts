import type { Lock } from "../../ports/lock"
import type { LockLease } from "../../ports/lock-lease"

import { tryWithLock, withLock } from "../with-lock"

function makeLease(): LockLease {
  return {
    key: "test:key",
    release: vi.fn(async () => {}),
    extend: vi.fn(async () => true),
  }
}

function makeLock(overrides?: Partial<Lock>): Lock {
  return {
    acquire: vi.fn(async () => null),
    tryAcquire: vi.fn(async () => null),
    ...overrides,
  }
}

const ttl = { milliseconds: 5_000 } as const

describe("tryWithLock", () => {
  it("acquires lock, runs fn, and releases", async () => {
    const lease = makeLease()
    const lock = makeLock({
      tryAcquire: vi.fn(async () => lease),
    })

    const fn = vi.fn(async () => "ok")

    const res = await tryWithLock(lock, "k", fn, { ttl })

    expect(res).toBe("ok")
    expect(lock.tryAcquire).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(lease.release).toHaveBeenCalledTimes(1)
  })

  it("returns fn result on success", async () => {
    const lease = makeLease()
    const lock = makeLock({ tryAcquire: vi.fn(async () => lease) })

    const fn = vi.fn(async () => ({ answer: 42 }))

    await expect(tryWithLock(lock, "k", fn, { ttl })).resolves.toEqual({
      answer: 42,
    })

    expect(lease.release).toHaveBeenCalledTimes(1)
  })

  it("returns null when lock cannot be acquired", async () => {
    const lock = makeLock({ tryAcquire: vi.fn(async () => null) })
    const fn = vi.fn(async () => "should-not-run")

    const res = await tryWithLock(lock, "k", fn, { ttl })

    expect(res).toBeNull()
    expect(fn).not.toHaveBeenCalled()
  })

  it("releases lock even when fn throws", async () => {
    const lease = makeLease()
    const lock = makeLock({ tryAcquire: vi.fn(async () => lease) })

    const err = new Error("boom")
    const fn = vi.fn(async () => {
      throw err
    })

    await expect(tryWithLock(lock, "k", fn, { ttl })).rejects.toBe(err)
    expect(lease.release).toHaveBeenCalledTimes(1)
  })

  it("propagates fn error after releasing lock", async () => {
    const lease = makeLease()
    const lock = makeLock({ tryAcquire: vi.fn(async () => lease) })

    const err = new Error("boom")
    const fn = vi.fn(async () => {
      throw err
    })

    try {
      await tryWithLock(lock, "k", fn, { ttl })
      expect.unreachable("expected to throw")
    } catch (e) {
      expect(e).toBe(err)
      expect(lease.release).toHaveBeenCalledTimes(1)
    }
  })

  it("does not run fn if lock acquisition fails", async () => {
    const lock = makeLock({ tryAcquire: vi.fn(async () => null) })
    const fn = vi.fn(async () => "should-not-run")

    const res = await tryWithLock(lock, "k", fn, { ttl })

    expect(res).toBeNull()
    expect(fn).not.toHaveBeenCalled()
  })
})

describe("withLock", () => {
  it("acquires lock, runs fn, and releases", async () => {
    const lease = makeLease()
    const lock = makeLock({
      acquire: vi.fn(async () => lease),
    })

    const fn = vi.fn(async () => "ok")

    const res = await withLock(lock, "k", fn, { ttl })

    expect(res).toBe("ok")
    expect(lock.acquire).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(lease.release).toHaveBeenCalledTimes(1)
  })

  it("returns fn result on success", async () => {
    const lease = makeLease()
    const lock = makeLock({ acquire: vi.fn(async () => lease) })

    const fn = vi.fn(async () => 123)

    await expect(withLock(lock, "k", fn, { ttl })).resolves.toBe(123)
    expect(lease.release).toHaveBeenCalledTimes(1)
  })

  it("throws when lock cannot be acquired", async () => {
    const lock = makeLock({ acquire: vi.fn(async () => null) })
    const fn = vi.fn(async () => "should-not-run")

    await expect(withLock(lock, "k", fn, { ttl })).rejects.toBeInstanceOf(Error)
    expect(fn).not.toHaveBeenCalled()
  })

  it("releases lock even when fn throws", async () => {
    const lease = makeLease()
    const lock = makeLock({ acquire: vi.fn(async () => lease) })

    const err = new Error("boom")
    const fn = vi.fn(async () => {
      throw err
    })

    await expect(withLock(lock, "k", fn, { ttl })).rejects.toBe(err)
    expect(lease.release).toHaveBeenCalledTimes(1)
  })

  it("propagates fn error after releasing lock", async () => {
    const lease = makeLease()
    const lock = makeLock({ acquire: vi.fn(async () => lease) })

    const err = new Error("boom")
    const fn = vi.fn(async () => {
      throw err
    })

    try {
      await withLock(lock, "k", fn, { ttl })
      expect.unreachable("expected to throw")
    } catch (e) {
      expect(e).toBe(err)
      expect(lease.release).toHaveBeenCalledTimes(1)
    }
  })

  it("respects signal abort before acquisition", async () => {
    const lease = makeLease()
    const lock = makeLock({ acquire: vi.fn(async () => lease) })

    const ac = new AbortController()
    ac.abort()

    const fn = vi.fn(async () => "should-not-run")

    await expect(
      withLock(lock, "k", fn, { ttl, signal: ac.signal }),
    ).rejects.toBeInstanceOf(Error)

    expect(lock.acquire).not.toHaveBeenCalled()
    expect(fn).not.toHaveBeenCalled()
    expect(lease.release).not.toHaveBeenCalled()
  })

  it("does not run fn if lock acquisition fails", async () => {
    const lock = makeLock({ acquire: vi.fn(async () => null) })
    const fn = vi.fn(async () => "should-not-run")

    await expect(withLock(lock, "k", fn, { ttl })).rejects.toBeInstanceOf(Error)
    expect(fn).not.toHaveBeenCalled()
  })
})
