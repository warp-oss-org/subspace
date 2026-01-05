import type { Clock, Milliseconds } from "@subspace/clock"
import type { BytesKeyValueStoreCas } from "../../ports/bytes-kv-store"
import type { KvCasResult, KvResultVersioned, KvVersion } from "../../ports/kv-cas"
import type { KvKey } from "../../ports/kv-key"
import type { KvSetOptions, KvTtl } from "../../ports/kv-options"
import type { KvResult } from "../../ports/kv-result"
import type { KvEntry } from "../../ports/kv-value"

type MemoryCasEntry = {
  value: Uint8Array
  version: KvVersion
  expiresAtMs?: Milliseconds
}

export type MemoryKvCasDeps = {
  clock: Clock
}

export type MemoryKvCasOptions = {
  maxEntries?: number
}

export class MemoryBytesKeyValueStoreCas implements BytesKeyValueStoreCas {
  private readonly store = new Map<KvKey, MemoryCasEntry>()
  private versionCounter = 0

  public constructor(
    private readonly deps: MemoryKvCasDeps,
    private readonly opts: MemoryKvCasOptions = {},
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

    const preservedExpiresAtMs =
      !opts?.ttl && existing && !this.isExpired(existing)
        ? existing.expiresAtMs
        : undefined

    const expiresAtMs = opts?.ttl ? this.computeExpiresAt(opts.ttl) : preservedExpiresAtMs

    const entry: MemoryCasEntry = {
      value: new Uint8Array(value),
      version: this.nextVersion(),
      ...(expiresAtMs !== undefined && { expiresAtMs }),
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

  async getVersioned(key: KvKey): Promise<KvResultVersioned<Uint8Array>> {
    const entry = this.store.get(key)

    if (!entry || this.isExpired(entry)) {
      this.store.delete(key)
      return { kind: "not_found" }
    }

    return {
      kind: "found",
      value: entry.value,
      version: entry.version,
    }
  }

  async setIfVersion(
    key: KvKey,
    value: Uint8Array,
    expectedVersion: KvVersion,
    opts?: Partial<KvSetOptions>,
  ): Promise<KvCasResult> {
    const entry = this.store.get(key)

    if (!entry || this.isExpired(entry)) {
      this.store.delete(key)
      return { kind: "not_found" }
    }

    if (entry.version !== expectedVersion) {
      return { kind: "conflict" }
    }

    const newVersion = this.nextVersion()

    const expiresAtMs = opts?.ttl ? this.computeExpiresAt(opts.ttl) : entry.expiresAtMs

    const newEntry: MemoryCasEntry = {
      value: new Uint8Array(value),
      version: newVersion,
      ...(expiresAtMs !== undefined && { expiresAtMs }),
    }

    this.store.set(key, newEntry)

    return { kind: "written", version: newVersion }
  }

  private nextVersion(): KvVersion {
    this.versionCounter++
    return String(this.versionCounter)
  }

  private enforceMaxEntries(key: KvKey): void {
    if (this.opts.maxEntries === undefined) return
    if (this.store.has(key)) return

    this.purgeExpired()

    if (this.store.size >= this.opts.maxEntries) {
      throw new Error(
        `MemoryBytesKeyValueStoreCas: max entries (${this.opts.maxEntries}) exceeded`,
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

  private isExpired(entry: MemoryCasEntry): boolean {
    if (entry.expiresAtMs === undefined) return false

    return this.deps.clock.nowMs() >= entry.expiresAtMs
  }

  private computeExpiresAt(ttl?: KvTtl): Milliseconds | undefined {
    if (!ttl) return undefined

    return this.deps.clock.nowMs() + ttl.milliseconds
  }
}
