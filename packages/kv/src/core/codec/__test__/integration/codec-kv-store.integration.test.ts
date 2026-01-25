import { FakeClock } from "@subspace/clock"
import { describe, expect, it } from "vitest"
import { MemoryBytesKeyValueStore } from "../../../../adapters/memory/memory-bytes-kv-store"
import type { Codec } from "../../../../ports/codec"
import { CodecKeyValueStore } from "../../codec-kv-store"

describe("CodecKeyValueStore (integration)", () => {
  it("round-trips value through a real codec + MemoryBytesKeyValueStore (get/set)", async () => {
    const bytesStore = new MemoryBytesKeyValueStore({ clock: new FakeClock() }, {})

    const codec: Codec<string> = {
      encode: (s) => new TextEncoder().encode(s),
      decode: (b) => new TextDecoder().decode(b),
    }

    const store = new CodecKeyValueStore({ bytesStore, codec })

    await store.set("k:one", "hello")

    const res = await store.get("k:one")

    expect(res).toStrictEqual({ kind: "found", value: "hello" })
  })

  it("round-trips value through a real codec + MemoryBytesKeyValueStore (setMany/getMany)", async () => {
    const bytesStore = new MemoryBytesKeyValueStore({ clock: new FakeClock() }, {})

    const codec: Codec<string> = {
      encode: (s) => new TextEncoder().encode(s),
      decode: (b) => new TextDecoder().decode(b),
    }

    const store = new CodecKeyValueStore({ bytesStore, codec })

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
})
