import { FakeClock } from "@subspace/clock"
import { describe, expect, it } from "vitest"
import { MemoryBytesKeyValueStoreCas } from "../../../../adapters/memory/memory-bytes-kv-cas"
import type { Codec } from "../../../../ports/codec"
import { CodecKeyValueStoreCas } from "../../codec-kv-cas"

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()
const stringCodec: Codec<string> = {
  encode: (value: string) => textEncoder.encode(value),
  decode: (bytes: Uint8Array) => textDecoder.decode(bytes),
}

describe("CodecKeyValueStoreCas integration", () => {
  it("round-trips value through a real codec + MemoryBytesKeyValueStore (get/set)", async () => {
    const clock = new FakeClock()
    const bytesStore = new MemoryBytesKeyValueStoreCas({ clock })
    const store = new CodecKeyValueStoreCas({ bytesStore, codec: stringCodec })

    await store.set("foo", "hello")
    const result = await store.get("foo")

    expect(result).toEqual({ kind: "found", value: "hello" })
  })

  it("round-trips value through a real codec + MemoryBytesKeyValueStore (setMany/getMany)", async () => {
    const clock = new FakeClock()
    const bytesStore = new MemoryBytesKeyValueStoreCas({ clock })
    const store = new CodecKeyValueStoreCas({ bytesStore, codec: stringCodec })

    await store.setMany([
      ["foo", "hello"],
      ["bar", "world"],
    ])

    const result = await store.getMany(["foo", "bar", "baz"])
    expect(result.get("foo")).toEqual({ kind: "found", value: "hello" })
    expect(result.get("bar")).toEqual({ kind: "found", value: "world" })
    expect(result.get("baz")).toEqual({ kind: "not_found" })
  })

  it("getVersioned returns version and decodes value", async () => {
    const clock = new FakeClock()
    const bytesStore = new MemoryBytesKeyValueStoreCas({ clock })
    const store = new CodecKeyValueStoreCas({ bytesStore, codec: stringCodec })
    await store.set("foo", "hello")

    const result = await store.getVersioned("foo")

    expect(result.kind).toBe("found")
    if (result.kind === "found") {
      expect(result.value).toBe("hello")
      expect(result.version).toBeDefined()
    }
  })

  it("setIfVersion only writes when expected version matches", async () => {
    const clock = new FakeClock()
    const bytesStore = new MemoryBytesKeyValueStoreCas({ clock })
    const store = new CodecKeyValueStoreCas({ bytesStore, codec: stringCodec })

    await store.set("foo", "first")
    const versioned = await store.getVersioned("foo")

    expect(versioned.kind).toBe("found")
    if (versioned.kind !== "found") throw new Error("Should be found")

    const version = versioned.version
    await store.setIfVersion("foo", "second", version)
    const afterMatchingVersion = await store.get("foo")
    expect(afterMatchingVersion).toEqual({ kind: "found", value: "second" })

    await store.setIfVersion("foo", "third", version)

    const afterStaleVersion = await store.get("foo")
    expect(afterStaleVersion).toEqual({ kind: "found", value: "second" })
  })
})
