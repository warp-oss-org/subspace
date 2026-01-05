import type { Clock, Milliseconds } from "@subspace/clock"
import type { BytesKeyValueStoreConditional } from "../../ports/bytes-kv-store"
import type { KvWriteResult } from "../../ports/kv-conditional"
import type { KvKey } from "../../ports/kv-key"
import type { KvSetOptions, KvTtl } from "../../ports/kv-options"
import type { KvResult } from "../../ports/kv-result"
import type { KvEntry } from "../../ports/kv-value"

type MemoryConditionalEntry = {
  value: Uint8Array
  expiresAtMs?: Milliseconds
}

export type MemoryKvConditionalDeps = {
  clock: Clock
}

export type MemoryKvConditionalOptions = {
  maxEntries?: number
}

export class MemoryBytesKeyValueStoreConditional
  implements BytesKeyValueStoreConditional
{
  private readonly store = new Map<KvKey, MemoryConditionalEntry>()

  public constructor(
    private readonly deps: MemoryKvConditionalDeps,
    private readonly opts: MemoryKvConditionalOptions = {},
  ) {}

  async setIfNotExists(
    key: KvKey,
    value: Uint8Array,
    opts?: Partial<KvSetOptions>,
  ): Promise<KvWriteResult> {
    const entry = this.store.get(key)

    if (entry && !this.isExpired(entry)) {
      return { kind: "skipped" }
    }

    this.enforceMaxEntries(key)

    const expiresAtMs = this.computeExpiresAt(opts?.ttl)

    this.store.set(key, {
      value: new Uint8Array(value),
      ...(expiresAtMs !== undefined && { expiresAtMs }),
    })

    return { kind: "written" }
  }

  async setIfExists(
    key: KvKey,
    value: Uint8Array,
    opts?: Partial<KvSetOptions>,
  ): Promise<KvWriteResult> {
    const entry = this.store.get(key)

    if (!entry || this.isExpired(entry)) {
      this.store.delete(key)
      return { kind: "skipped" }
    }

    const expiresAtMs = this.computeExpiresAtOrPreserve(entry, opts?.ttl)

    this.store.set(key, {
      value: new Uint8Array(value),
      ...(expiresAtMs !== undefined && { expiresAtMs }),
    })

    return { kind: "written" }
  }

  async get(key: KvKey): Promise<KvResult<Uint8Array>> {
    const entry = this.store.get(key)

    if (!entry || this.isExpired(entry)) {
      this.store.delete(key)
      return { kind: "not_found" }
    }

    return { kind: "found", value: entry.value }
  }

  async set(key: KvKey, value: Uint8Array, opts?: Partial<KvSetOptions>): Promise<void> {
    this.enforceMaxEntries(key)

    const existing = this.store.get(key)
    const expiresAtMs = this.computeExpiresAtOrPreserve(existing, opts?.ttl)

    this.store.set(key, {
      value: new Uint8Array(value),
      ...(expiresAtMs !== undefined && { expiresAtMs }),
    })
  }

  async delete(key: KvKey): Promise<void> {
    this.store.delete(key)
  }

  async has(key: KvKey): Promise<boolean> {
    const entry = this.store.get(key)

    if (!entry || this.isExpired(entry)) {
      this.store.delete(key)
      return false
    }

    return true
  }

  async getMany(keys: readonly KvKey[]): Promise<Map<KvKey, KvResult<Uint8Array>>> {
    const out = new Map<KvKey, KvResult<Uint8Array>>()

    for (const key of keys) {
      out.set(key, await this.get(key))
    }

    return out
  }

  async setMany(
    entries: readonly KvEntry<Uint8Array>[],
    opts?: Partial<KvSetOptions>,
  ): Promise<void> {
    for (const [key, value] of entries) {
      await this.set(key, value, opts)
    }
  }

  async deleteMany(keys: readonly KvKey[]): Promise<void> {
    for (const key of keys) {
      this.store.delete(key)
    }
  }

  private enforceMaxEntries(key: KvKey): void {
    if (this.opts.maxEntries === undefined) return
    if (this.store.has(key)) return

    this.purgeExpired()

    if (this.store.size >= this.opts.maxEntries) {
      throw new Error(
        `MemoryBytesKeyValueStoreConditional: max entries (${this.opts.maxEntries}) exceeded`,
      )
    }
  }

  private purgeExpired(): void {
    for (const [key, entry] of this.store) {
      if (this.isExpired(entry)) {
        this.store.delete(key)
      }
    }
  }

  private isExpired(entry: MemoryConditionalEntry): boolean {
    if (entry.expiresAtMs === undefined) return false

    return this.deps.clock.nowMs() >= entry.expiresAtMs
  }

  private computeExpiresAtOrPreserve(
    existing: MemoryConditionalEntry | undefined,
    ttl?: KvTtl,
  ): Milliseconds | undefined {
    if (ttl) return this.computeExpiresAt(ttl)

    return existing?.expiresAtMs
  }

  private computeExpiresAt(ttl?: KvTtl): Milliseconds | undefined {
    if (!ttl) return undefined

    return this.deps.clock.nowMs() + ttl.milliseconds
  }
}
