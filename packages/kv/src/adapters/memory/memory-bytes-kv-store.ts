import type { Clock, Milliseconds } from "@subspace/clock"
import type { BytesKeyValueStore } from "../../ports/bytes-kv-store"
import type { KvKey } from "../../ports/kv-key"
import type { KvSetOptions, KvTtl } from "../../ports/kv-options"
import type { KvResult } from "../../ports/kv-result"
import type { KvEntry } from "../../ports/kv-value"

export type MemoryKvStoreOptions = {
  /**
   * Maximum number of entries retained in the store.
   *
   * If enabled and the limit is exceeded, setters will throw an error.
   */
  maxEntries?: number
}

export type MemoryKvStoreDeps = {
  clock: Clock
}

export type MemoryKvStoreEntry = {
  value: Uint8Array
  expiresAtMs?: Milliseconds
}

export class MemoryBytesKeyValueStore implements BytesKeyValueStore {
  private readonly store = new Map<KvKey, MemoryKvStoreEntry>()

  public constructor(
    private readonly deps: MemoryKvStoreDeps,
    private readonly opts: MemoryKvStoreOptions,
  ) {}

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

    if (existing && this.isExpired(existing)) {
      this.store.delete(key)
    }

    const effectiveExpiresAtMs = opts?.ttl
      ? this.computeExpiresAt(opts.ttl)
      : this.store.get(key)?.expiresAtMs

    const entry: MemoryKvStoreEntry = {
      value: new Uint8Array(value),
      ...(effectiveExpiresAtMs !== undefined && { expiresAtMs: effectiveExpiresAtMs }),
    }

    this.store.set(key, entry)
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
        `MemoryBytesKeyValueStore: max entries (${this.opts.maxEntries}) exceeded`,
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

  private isExpired(entry: MemoryKvStoreEntry): boolean {
    if (entry.expiresAtMs === undefined) return false

    return this.deps.clock.nowMs() >= entry.expiresAtMs
  }

  private computeExpiresAt(ttl?: KvTtl): Milliseconds | undefined {
    if (!ttl) return undefined

    return this.deps.clock.nowMs() + ttl.milliseconds
  }
}
