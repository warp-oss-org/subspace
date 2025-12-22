import { describe, expect, it } from "vitest"
import { MemoryBytesCache } from "../../../adapters/memory/memory-bytes-cache"
import type { Codec } from "../../../ports/codec"
import { ManualTestClock } from "../../../tests/utils/manual-test-clock"
import { LruMemoryMap } from "../../eviction/lru-memory-map"
import { CodecDataCache } from "../codec-data-cache"

describe("CodecDataCache (sanity)", () => {
  it("round-trips value through a real codec + MemoryBytesCache (get/set)", async () => {
    const bytesCache = new MemoryBytesCache(
      { clock: new ManualTestClock(new Date(0)), store: new LruMemoryMap() },
      { maxEntries: 100 },
    )

    const codec: Codec<string> = {
      encode: (s) => new TextEncoder().encode(s),
      decode: (b) => new TextDecoder().decode(b),
    }

    const cache = new CodecDataCache(bytesCache, codec)

    await cache.set("k:one", "hello")

    const res = await cache.get("k:one")

    expect(res).toStrictEqual({ kind: "hit", value: "hello" })
  })

  it("round-trips value through a real codec + MemoryBytesCache (setMany/getMany)", async () => {
    const bytesCache = new MemoryBytesCache(
      { clock: new ManualTestClock(new Date(0)), store: new LruMemoryMap() },
      { maxEntries: 100 },
    )

    const codec: Codec<string> = {
      encode: (s) => new TextEncoder().encode(s),
      decode: (b) => new TextDecoder().decode(b),
    }

    const cache = new CodecDataCache(bytesCache, codec)

    await cache.setMany([
      ["k:one", "hello"],
      ["k:two", "world"],
    ])

    const res = await cache.getMany(["k:one", "k:two", "k:three"])

    expect(res).toStrictEqual(
      new Map([
        ["k:one", { kind: "hit", value: "hello" }],
        ["k:two", { kind: "hit", value: "world" }],
        ["k:three", { kind: "miss" }],
      ]),
    )
  })
})
