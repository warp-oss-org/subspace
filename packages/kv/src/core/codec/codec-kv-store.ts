import type { BytesKeyValueStore } from "../../ports/bytes-kv-store"
import type { Codec } from "../../ports/codec"
import type { KvKey } from "../../ports/kv-key"
import type { KvSetOptions } from "../../ports/kv-options"
import type { KvResult } from "../../ports/kv-result"
import type { KeyValueStore } from "../../ports/kv-store"
import type { KvEntry } from "../../ports/kv-value"

export type CodecKeyValueStoreDeps<T> = {
  codec: Codec<T>
  bytesStore: BytesKeyValueStore
}

export class CodecKeyValueStore<T> implements KeyValueStore<T> {
  public constructor(private readonly deps: CodecKeyValueStoreDeps<T>) {}

  async get(key: KvKey): Promise<KvResult<T>> {
    const res = await this.deps.bytesStore.get(key)

    return this.decodeResult(res)
  }

  async set(key: KvKey, value: T, opts?: Partial<KvSetOptions>): Promise<void> {
    await this.deps.bytesStore.set(key, this.deps.codec.encode(value), opts)
  }

  async delete(key: KvKey): Promise<void> {
    await this.deps.bytesStore.delete(key)
  }

  async has(key: KvKey): Promise<boolean> {
    return await this.deps.bytesStore.has(key)
  }

  async getMany(keys: readonly KvKey[]): Promise<Map<KvKey, KvResult<T>>> {
    const res = await this.deps.bytesStore.getMany(keys)

    const out = new Map<KvKey, KvResult<T>>()
    for (const [k, v] of res.entries()) {
      out.set(k, this.decodeResult(v))
    }

    return out
  }

  async setMany(
    entries: readonly KvEntry<T>[],
    opts?: Partial<KvSetOptions>,
  ): Promise<void> {
    const encoded: readonly KvEntry<Uint8Array>[] = entries.map(
      ([k, v]) => [k, this.deps.codec.encode(v)] as const,
    )
    await this.deps.bytesStore.setMany(encoded, opts)
  }

  async deleteMany(keys: readonly KvKey[]): Promise<void> {
    await this.deps.bytesStore.deleteMany(keys)
  }

  private decodeResult(res: KvResult<Uint8Array>): KvResult<T> {
    if (res.kind === "not_found") {
      return {
        kind: "not_found",
      }
    }

    return {
      kind: "found",
      value: this.deps.codec.decode(res.value),
    }
  }
}
