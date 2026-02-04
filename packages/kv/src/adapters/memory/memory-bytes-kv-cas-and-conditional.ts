import type { Clock, Milliseconds } from "@subspace/clock"
import type {
  BytesKeyValueStoreCas,
  BytesKeyValueStoreConditional,
} from "../../ports/bytes-kv-store"
import type { KvCasResult, KvResultVersioned, KvVersion } from "../../ports/kv-cas"
import type { KvWriteResult } from "../../ports/kv-conditional"
import type { KvKey } from "../../ports/kv-key"
import type { KvSetOptions, KvTtl } from "../../ports/kv-options"
import type { KvResult } from "../../ports/kv-result"
import type { KvEntry } from "../../ports/kv-value"

type MemoryEntry = {
  value: Uint8Array
  version: KvVersion
  expiresAtMs?: Milliseconds
}

export type MemoryKvDeps = {
  clock: Clock
}

export type MemoryKvOptions = {
  maxEntries?: number
}

// !! TODO: Tests for this class
export class MemoryBytesKeyValueStoreCasConditional
  implements BytesKeyValueStoreCas, BytesKeyValueStoreConditional
{
  private readonly store = new Map<KvKey, MemoryEntry>()
  private versionCounter = 0

  public constructor(
    private readonly deps: MemoryKvDeps,
    private readonly opts: MemoryKvOptions = {},
  ) {}

  async setIfNotExists(
    key: KvKey,
    value: Uint8Array,
    opts?: Partial<KvSetOptions>,
  ): Promise<KvWriteResult> {
    const existing = this.getLiveEntry(key)
    if (existing) return { kind: "skipped" }

    await this.set(key, value, opts)
    return { kind: "written" }
  }

  async setIfExists(
    key: KvKey,
    value: Uint8Array,
    opts?: Partial<KvSetOptions>,
  ): Promise<KvWriteResult> {
    const existing = this.getLiveEntry(key)

    if (!existing) return { kind: "skipped" }

    await this.set(key, value, opts)
    return { kind: "written" }
  }

  async get(key: KvKey): Promise<KvResult<Uint8Array>> {
    const entry = this.getLiveEntry(key)
    if (!entry) return { kind: "not_found" }

    return { kind: "found", value: entry.value }
  }

  async set(key: KvKey, value: Uint8Array, opts?: Partial<KvSetOptions>): Promise<void> {
    this.enforceMaxEntries(key)

    const existing = this.getLiveEntry(key) // deletes if expired
    const expiresAtMs = this.computeExpiresAtOrPreserve(existing, opts?.ttl)

    const entry: MemoryEntry = {
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
    return this.getLiveEntry(key) !== undefined
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
    for (const [key, value] of entries) await this.set(key, value, opts)
  }

  async deleteMany(keys: readonly KvKey[]): Promise<void> {
    for (const key of keys) this.store.delete(key)
  }

  async getVersioned(key: KvKey): Promise<KvResultVersioned<Uint8Array>> {
    const entry = this.getLiveEntry(key)
    if (!entry) return { kind: "not_found" }

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
    const entry = this.getLiveEntry(key)
    if (!entry) return { kind: "not_found" }

    if (entry.version !== expectedVersion) {
      return { kind: "conflict" }
    }

    const newVersion = this.nextVersion()
    const expiresAtMs = this.computeExpiresAtOrPreserve(entry, opts?.ttl)

    this.store.set(key, {
      value: new Uint8Array(value),
      version: newVersion,
      ...(expiresAtMs !== undefined && { expiresAtMs }),
    })

    return { kind: "written", version: newVersion }
  }

  private getLiveEntry(key: KvKey): MemoryEntry | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined

    if (this.isExpired(entry)) {
      this.store.delete(key)
      return undefined
    }

    return entry
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
        `MemoryBytesKeyValueStoreCasConditional: max entries (${this.opts.maxEntries}) exceeded`,
      )
    }
  }

  private purgeExpired(): void {
    for (const [key, entry] of this.store) {
      if (this.isExpired(entry)) this.store.delete(key)
    }
  }

  private isExpired(entry: MemoryEntry): boolean {
    if (entry.expiresAtMs === undefined) return false
    return this.deps.clock.nowMs() >= entry.expiresAtMs
  }

  private computeExpiresAtOrPreserve(
    existing: MemoryEntry | undefined,
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
