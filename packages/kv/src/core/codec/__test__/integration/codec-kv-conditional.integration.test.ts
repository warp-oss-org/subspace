import { FakeClock } from "@subspace/clock"
import { describe, expect, it } from "vitest"
import { MemoryBytesKeyValueStoreConditional } from "../../../../adapters/memory/memory-bytes-kv-conditional"
import type { Codec } from "../../../../ports/codec"
import { CodecKeyValueStoreConditional } from "../../codec-kv-conditional"

describe("CodecKeyValueStoreConditional (integration)", () => {
  it("round-trips value through a real codec + MemoryBytesKeyValueStore (get/set)", async () => {
    const bytesStore = new MemoryBytesKeyValueStoreConditional(
      { clock: new FakeClock() },
      {},
    )

    const codec: Codec<string> = {
      encode: (s) => new TextEncoder().encode(s),
      decode: (b) => new TextDecoder().decode(b),
    }

    const store = new CodecKeyValueStoreConditional({ bytesStore, codec })

    await store.set("k:one", "hello")

    const res = await store.get("k:one")

    expect(res).toStrictEqual({ kind: "found", value: "hello" })
  })

  it("round-trips value through a real codec + MemoryBytesKeyValueStore (setMany/getMany)", async () => {
    const bytesStore = new MemoryBytesKeyValueStoreConditional(
      { clock: new FakeClock() },
      {},
    )

    const codec: Codec<string> = {
      encode: (s) => new TextEncoder().encode(s),
      decode: (b) => new TextDecoder().decode(b),
    }

    const store = new CodecKeyValueStoreConditional({ bytesStore, codec })

    await store.setMany([
      ["k:one", "hello"],
      ["k:two", "world"],
    ])

    const res = await store.getMany(["k:one", "k:two", "k:three"])

    expect(res).toStrictEqual(
      new Map([
        ["k:one", { kind: "found", value: "hello" }],
        ["k:two", { kind: "found", value: "world" }],
        ["k:three", { kind: "not_found" }],
      ]),
    )
  })

  it("setIfNotExists writes only once when key is missing", async () => {
    const bytesStore = new MemoryBytesKeyValueStoreConditional(
      { clock: new FakeClock() },
      {},
    )

    const codec: Codec<string> = {
      encode: (s) => new TextEncoder().encode(s),
      decode: (b) => new TextDecoder().decode(b),
    }

    const store = new CodecKeyValueStoreConditional({ bytesStore, codec })

    await store.setIfNotExists("k:cond:ine", "first")
    expect(await store.get("k:cond:ine")).toStrictEqual({ kind: "found", value: "first" })

    await store.setIfNotExists("k:cond:ine", "second")
    expect(await store.get("k:cond:ine")).toStrictEqual({ kind: "found", value: "first" })
  })

  it("setIfExists writes only when key already exists", async () => {
    const bytesStore = new MemoryBytesKeyValueStoreConditional(
      { clock: new FakeClock() },
      {},
    )

    const codec: Codec<string> = {
      encode: (s) => new TextEncoder().encode(s),
      decode: (b) => new TextDecoder().decode(b),
    }

    const store = new CodecKeyValueStoreConditional({ bytesStore, codec })

    await store.setIfExists("k:cond:ie", "nope")
    expect(await store.get("k:cond:ie")).toStrictEqual({ kind: "not_found" })

    await store.set("k:cond:ie", "first")
    await store.setIfExists("k:cond:ie", "second")
    expect(await store.get("k:cond:ie")).toStrictEqual({ kind: "found", value: "second" })
  })
})
