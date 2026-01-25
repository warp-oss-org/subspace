import type { BytesKeyValueStoreCas } from "../../ports/bytes-kv-store"
import type { KvCasResult, KvResultVersioned, KvVersion } from "../../ports/kv-cas"
import type { KvKey } from "../../ports/kv-key"
import type { KvSetOptions } from "../../ports/kv-options"
import type { KvResult } from "../../ports/kv-result"
import type { KvEntry } from "../../ports/kv-value"
import type { RedisKvStoreOptions } from "./redis-bytes-kv-store"
import type { RedisBytesClient } from "./redis-client"

export type RedisBytesKvCasDeps = {
  client: RedisBytesClient
}

/**
 * Redis implementation of BytesKeyValueStoreCas.
 *
 * @remarks
 * - Requires Redis 6+ (uses KEEPTTL)
 * - Maintains a separate version key (`key:v`) for each value key
 * - All writes (set, setMany, setIfVersion) increment the version atomically
 * - TTL policy: if ttl provided, set it; otherwise preserve existing TTL
 */
export class RedisBytesKeyValueStoreCas implements BytesKeyValueStoreCas {
  public constructor(
    private readonly deps: RedisBytesKvCasDeps,
    private readonly opts: RedisKvStoreOptions,
  ) {}

  async get(key: KvKey): Promise<KvResult<Uint8Array>> {
    if (this.isInternalMetadataKey(key)) {
      return { kind: "not_found" }
    }
    const fullKey = this.fullKey(key)
    const buffer = await this.deps.client.get(fullKey)

    if (buffer === null) {
      return { kind: "not_found" }
    }

    return { kind: "found", value: new Uint8Array(buffer) }
  }

  async set(key: KvKey, value: Uint8Array, opts?: Partial<KvSetOptions>): Promise<void> {
    if (this.isInternalMetadataKey(key)) {
      return
    }
    const fullKey = this.fullKey(key)
    const vKey = this.versionKey(fullKey)
    const buffer = this.toBuffer(value)
    const ttlMs = opts?.ttl ? String(opts.ttl.milliseconds) : ""

    await this.deps.client.eval(this.setWithVersionScript(), {
      keys: [fullKey, vKey],
      arguments: [buffer, ttlMs],
    })
  }

  async delete(key: KvKey): Promise<void> {
    if (this.isInternalMetadataKey(key)) {
      return
    }
    const fullKey = this.fullKey(key)
    const vKey = this.versionKey(fullKey)

    await this.deps.client.del([fullKey, vKey])
  }

  async has(key: KvKey): Promise<boolean> {
    if (this.isInternalMetadataKey(key)) {
      return false
    }
    const fullKey = this.fullKey(key)
    const exists = await this.deps.client.exists(fullKey)

    return exists >= 1
  }

  async getMany(keys: readonly KvKey[]): Promise<Map<KvKey, KvResult<Uint8Array>>> {
    if (keys.length === 0) return new Map()

    const out = new Map<KvKey, KvResult<Uint8Array>>()

    const fetchKeys: KvKey[] = []
    const fetchIndices: number[] = []

    for (const [i, key] of keys.entries()) {
      if (this.isInternalMetadataKey(key)) {
        out.set(key, { kind: "not_found" })
        continue
      }
      fetchKeys.push(key)
      fetchIndices.push(i)
    }

    if (fetchKeys.length === 0) return out

    const fullKeys = fetchKeys.map((k) => this.fullKey(k))
    const buffers = await this.deps.client.mGet(fullKeys)

    for (const [i, buffer] of buffers.entries()) {
      const key = fetchKeys[i]
      if (key === undefined) continue

      if (buffer === null || buffer === undefined) {
        out.set(key, { kind: "not_found" })
      } else {
        out.set(key, { kind: "found", value: new Uint8Array(buffer) })
      }
    }

    return out
  }

  async setMany(
    entries: readonly KvEntry<Uint8Array>[],
    opts?: Partial<KvSetOptions>,
  ): Promise<void> {
    if (entries.length === 0) return

    const ttlMs = opts?.ttl ? String(opts.ttl.milliseconds) : ""

    const multi = this.deps.client.multi()

    for (const [key, value] of entries) {
      if (this.isInternalMetadataKey(key)) continue

      const fullKey = this.fullKey(key)
      const vKey = this.versionKey(fullKey)
      const buffer = this.toBuffer(value)

      multi.eval(this.setWithVersionScript(), {
        keys: [fullKey, vKey],
        arguments: [buffer, ttlMs],
      })
    }

    await multi.exec()
  }

  async deleteMany(keys: readonly KvKey[]): Promise<void> {
    if (keys.length === 0) return

    const allKeys: string[] = []

    for (const key of keys) {
      if (this.isInternalMetadataKey(key)) continue

      const fullKey = this.fullKey(key)
      allKeys.push(fullKey, this.versionKey(fullKey))
    }

    if (allKeys.length === 0) return

    await this.deps.client.del(allKeys)
  }

  async getVersioned(key: KvKey): Promise<KvResultVersioned<Uint8Array>> {
    const fullKey = this.fullKey(key)
    const vKey = this.versionKey(fullKey)

    const result = (await this.deps.client.eval(this.getVersionedScript(), {
      keys: [fullKey, vKey],
      arguments: [],
    })) as [Buffer, unknown] | null

    if (result === null) {
      return { kind: "not_found" }
    }

    const [buffer, versionRaw] = result

    return {
      kind: "found",
      value: new Uint8Array(buffer),
      version: this.asString(versionRaw as Buffer),
    }
  }

  async setIfVersion(
    key: KvKey,
    value: Uint8Array,
    expectedVersion: KvVersion,
    opts?: Partial<KvSetOptions>,
  ): Promise<KvCasResult> {
    const fullKey = this.fullKey(key)
    const vKey = this.versionKey(fullKey)
    const buffer = this.toBuffer(value)
    const ttlMs = opts?.ttl ? String(opts.ttl.milliseconds) : ""

    const raw = (await this.deps.client.eval(this.setIfVersionScript(), {
      keys: [fullKey, vKey],
      arguments: [expectedVersion, buffer, ttlMs],
    })) as Buffer

    const result = this.asString(raw)

    if (result === "not_found") return { kind: "not_found" }
    if (result === "conflict") return { kind: "conflict" }

    return { kind: "written", version: result }
  }

  private getVersionedScript(): string {
    return `
      local value = redis.call('GET', KEYS[1])
      if not value then
        return nil
      end

      local version = redis.call('GET', KEYS[2])
      if not version then
        version = '0'
      end

      return { value, version }
    `
  }

  private setWithVersionScript(): string {
    return `
      -- KEYS[1] = value key
      -- KEYS[2] = version key
      -- ARGV[1] = value (bytes)
      -- ARGV[2] = ttlMs (string, optional; empty => preserve existing TTL)

      if ARGV[2] and ARGV[2] ~= '' then
        local ttl = tonumber(ARGV[2])
        redis.call('SET', KEYS[1], ARGV[1], 'PX', ttl)
        redis.call('INCR', KEYS[2])
        redis.call('PEXPIRE', KEYS[2], ttl)
      else
        redis.call('SET', KEYS[1], ARGV[1], 'KEEPTTL')
        redis.call('INCR', KEYS[2])

        -- Keep version key TTL aligned with the value key when a TTL already exists.
        local pttl = redis.call('PTTL', KEYS[1])
        if pttl > 0 then
          redis.call('PEXPIRE', KEYS[2], pttl)
        else
          -- If the value key has no TTL, ensure the version key is also persistent.
          redis.call('PERSIST', KEYS[2])
        end
      end
    `
  }

  private setIfVersionScript(): string {
    return `
      -- KEYS[1] = value key
      -- KEYS[2] = version key
      -- ARGV[1] = expected version
      -- ARGV[2] = new value
      -- ARGV[3] = ttlMs (optional; empty => preserve TTL)

      local current = redis.call('GET', KEYS[1])
      if not current then
        return 'not_found'
      end

      local currentVersion = redis.call('GET', KEYS[2])
      if not currentVersion then
        currentVersion = '0'
      end

      if currentVersion ~= ARGV[1] then
        return 'conflict'
      end

      if ARGV[3] and ARGV[3] ~= '' then
        local ttl = tonumber(ARGV[3])
        redis.call('SET', KEYS[1], ARGV[2], 'PX', ttl)
        local newVersion = redis.call('INCR', KEYS[2])
        redis.call('PEXPIRE', KEYS[2], ttl)
        return tostring(newVersion)
      else
        redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL')
        local newVersion = redis.call('INCR', KEYS[2])

        -- Keep version key TTL aligned with the value key when a TTL already exists.
        local pttl = redis.call('PTTL', KEYS[1])
        if pttl > 0 then
          redis.call('PEXPIRE', KEYS[2], pttl)
        else
          -- If the value key has no TTL, ensure the version key is also persistent.
          redis.call('PERSIST', KEYS[2])
        end

        return tostring(newVersion)
      end
    `
  }

  private isInternalMetadataKey(key: KvKey): boolean {
    return key.endsWith(":v")
  }

  private asString(buffer: Buffer): string {
    return buffer.toString("utf8")
  }

  private toBuffer(value: Uint8Array): Buffer {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
  }

  private versionKey(fullKey: string): string {
    return `${fullKey}:v`
  }

  private fullKey(k: KvKey): string {
    const prefix = this.opts.keyspacePrefix

    return `${prefix}:${k}`
  }
}
