import { mock } from "vitest-mock-extended"
import type { BytesCache } from "../../../ports/bytes-cache"
import type { CacheSetOptions } from "../../../ports/cache-options"
import type { Codec } from "../../../ports/codec"
import { bytes, keys } from "../../../tests/utils/cache-test-helpers"
import type { Mock } from "../../../tests/utils/mock"
import { CodecDataCache } from "../codec-data-cache"

describe("CodecDataCache<T>", () => {
  let bytesCache: Mock<BytesCache>
  let codec: Mock<Codec<string>>

  let codecCache: CodecDataCache<string>

  beforeEach(() => {
    bytesCache = mock<BytesCache>()
    codec = mock<Codec<string>>()

    codecCache = new CodecDataCache<string>(bytesCache, codec)
  })

  describe("get", () => {
    it("returns miss when underlying BytesCache misses (does not decode)", async () => {
      const key = "k:miss"
      bytesCache.get.mockResolvedValue({ kind: "miss" })

      const res = await codecCache.get(key)

      expect(bytesCache.get).toHaveBeenCalledExactlyOnceWith(key)
      expect(codec.decode).not.toHaveBeenCalled()
      expect(res).toStrictEqual({ kind: "miss" })
    })

    it("decodes bytes when underlying BytesCache hits", async () => {
      const key = "k:hit"
      const raw = new Uint8Array([1, 2, 3])

      bytesCache.get.mockResolvedValue({ kind: "hit", value: raw })
      codec.decode.mockReturnValue("decoded")

      const res = await codecCache.get(key)

      expect(bytesCache.get).toHaveBeenCalledExactlyOnceWith(key)
      expect(codec.decode).toHaveBeenCalledExactlyOnceWith(raw)
      expect(res).toStrictEqual({ kind: "hit", value: "decoded" })
    })
  })

  describe("set", () => {
    it("encodes value before writing to underlying BytesCache", async () => {
      const key = "k:set"
      const value = "hello"
      const encoded = new Uint8Array([9, 9])

      codec.encode.mockReturnValue(encoded)

      await codecCache.set(key, value)

      expect(codec.encode).toHaveBeenCalledExactlyOnceWith(value)
      expect(bytesCache.set).toHaveBeenCalledExactlyOnceWith(key, encoded, undefined)
    })

    it("passes set options through unchanged", async () => {
      const key = "k:set:opts"
      const value = "hello"
      const encoded = new Uint8Array([1])
      const opts: CacheSetOptions = { ttl: { kind: "seconds", seconds: 10 } }

      codec.encode.mockReturnValue(encoded)

      await codecCache.set(key, value, opts)

      expect(bytesCache.set).toHaveBeenCalledExactlyOnceWith(key, encoded, opts)
    })
  })

  describe("invalidate", () => {
    it("passes through to underlying BytesCache", async () => {
      const key = "k:inv"

      await codecCache.invalidate(key)

      expect(bytesCache.invalidate).toHaveBeenCalledExactlyOnceWith(key)
    })
  })

  describe("getMany", () => {
    it("decodes only hit entries; preserves misses", async () => {
      const k1 = keys.one()
      const k2 = keys.two()
      const k3 = keys.three()

      const b1 = bytes.a()
      const b3 = bytes.c()

      bytesCache.getMany.mockResolvedValue(
        new Map([
          [k1, { kind: "hit", value: b1 }],
          [k2, { kind: "miss" }],
          [k3, { kind: "hit", value: b3 }],
        ]),
      )

      codec.decode.mockReturnValueOnce("one").mockReturnValueOnce("three")

      const res = await codecCache.getMany([k1, k2, k3])

      expect(bytesCache.getMany).toHaveBeenCalledExactlyOnceWith([k1, k2, k3])

      expect(codec.decode).toHaveBeenCalledTimes(2)
      expect(codec.decode).toHaveBeenNthCalledWith(1, b1)
      expect(codec.decode).toHaveBeenNthCalledWith(2, b3)

      expect(res).toStrictEqual(
        new Map([
          [k1, { kind: "hit", value: "one" }],
          [k2, { kind: "miss" }],
          [k3, { kind: "hit", value: "three" }],
        ]),
      )
    })

    it("preserves key order of the returned Map (same insertion order as input keys)", async () => {
      const keysIn = ["k:b", "k:a", "k:c"]

      bytesCache.getMany.mockResolvedValue(
        new Map([
          ["k:b", { kind: "miss" }],
          ["k:a", { kind: "miss" }],
          ["k:c", { kind: "miss" }],
        ]),
      )

      const res = await codecCache.getMany(keysIn)

      const outKeys = Array.from(res.keys())
      expect(outKeys).toStrictEqual(keysIn)
    })
  })

  describe("setMany", () => {
    it("encodes all values before writing", async () => {
      const entries: ReadonlyArray<readonly [string, string]> = [
        ["k:1", "one"],
        ["k:2", "two"],
      ]

      const b1 = new Uint8Array([1])
      const b2 = new Uint8Array([2])

      codec.encode.mockReturnValueOnce(b1).mockReturnValueOnce(b2)

      await codecCache.setMany(entries)

      expect(codec.encode).toHaveBeenCalledTimes(2)
      expect(codec.encode).toHaveBeenNthCalledWith(1, "one")
      expect(codec.encode).toHaveBeenNthCalledWith(2, "two")

      expect(bytesCache.setMany).toHaveBeenCalledExactlyOnceWith(
        [
          ["k:1", b1],
          ["k:2", b2],
        ],
        undefined,
      )
    })

    it("passes set options through unchanged", async () => {
      const entries: ReadonlyArray<readonly [string, string]> = [["k:1", "one"]]
      const encoded = new Uint8Array([7])
      const opts: CacheSetOptions = { ttl: { kind: "seconds", seconds: 1 } }

      codec.encode.mockReturnValue(encoded)

      await codecCache.setMany(entries, opts)

      expect(bytesCache.setMany).toHaveBeenCalledExactlyOnceWith([["k:1", encoded]], opts)
    })

    it("handles duplicate keys deterministically (documented semantics)", async () => {
      const entries: ReadonlyArray<readonly [string, string]> = [
        ["k:dup", "first"],
        ["k:dup", "second"],
      ]

      const b1 = new Uint8Array([1])
      const b2 = new Uint8Array([2])

      codec.encode.mockReturnValueOnce(b1).mockReturnValueOnce(b2)

      await codecCache.setMany(entries)

      expect(bytesCache.setMany).toHaveBeenCalledTimes(1)
      expect(bytesCache.setMany).toHaveBeenCalledWith(
        [
          ["k:dup", b1],
          ["k:dup", b2],
        ],
        undefined,
      )
    })
  })

  describe("invalidateMany", () => {
    it("passes through to underlying BytesCache", async () => {
      const keysIn = ["k:1", "k:2"]

      await codecCache.invalidateMany(keysIn)

      expect(bytesCache.invalidateMany).toHaveBeenCalledExactlyOnceWith(keysIn)
    })
  })

  describe("error propagation", () => {
    it("propagates codec.encode errors (does not swallow)", async () => {
      const err = new Error("encode failed")
      codec.encode.mockImplementation(() => {
        throw err
      })

      const promise = codecCache.set("k:1", "value")

      await expect(promise).rejects.toBe(err)
      expect(bytesCache.set).not.toHaveBeenCalled()
    })

    it("propagates codec.decode errors (does not swallow)", async () => {
      const err = new Error("decode failed")
      const raw = new Uint8Array([1])

      bytesCache.get.mockResolvedValue({ kind: "hit", value: raw })
      codec.decode.mockImplementation(() => {
        throw err
      })

      const promise = codecCache.get("k:1")

      await expect(promise).rejects.toBe(err)
    })

    it("propagates underlying BytesCache errors (does not swallow)", async () => {
      const err = new Error("bytes failed")
      bytesCache.get.mockRejectedValue(err)

      const promise = codecCache.get("k:1")

      await expect(promise).rejects.toBe(err)
    })
  })
})
