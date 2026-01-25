import { mock } from "vitest-mock-extended"
import type { BytesKeyValueStoreConditional } from "../../../../ports/bytes-kv-store"
import type { Codec } from "../../../../ports/codec"
import type { KvWriteResult } from "../../../../ports/kv-conditional"
import type { KvSetOptions } from "../../../../ports/kv-options"
import type { Mock } from "../../../../tests/mock"
import { bytes, keys } from "../../../../tests/utils/kv-test-helpers"
import { CodecKeyValueStoreConditional } from "../../codec-kv-conditional"

describe("CodecKeyValueStoreConditional<T>", () => {
  let bytesStore: Mock<BytesKeyValueStoreConditional>
  let codec: Mock<Codec<string>>

  let codecStore: CodecKeyValueStoreConditional<string>

  beforeEach(() => {
    bytesStore = mock<BytesKeyValueStoreConditional>()
    codec = mock<Codec<string>>()

    codecStore = new CodecKeyValueStoreConditional<string>({
      bytesStore,
      codec,
    })
  })

  describe("get", () => {
    it("returns not_found when underlying BytesKeyValueStoreConditional misses (does not decode)", async () => {
      const key = "k:miss"
      bytesStore.get.mockResolvedValue({ kind: "not_found" })

      const res = await codecStore.get(key)

      expect(bytesStore.get).toHaveBeenCalledExactlyOnceWith(key)
      expect(codec.decode).not.toHaveBeenCalled()
      expect(res).toStrictEqual({ kind: "not_found" })
    })

    it("decodes bytes when underlying BytesKeyValueStoreConditional hits", async () => {
      const key = "k:hit"
      const raw = new Uint8Array([1, 2, 3])

      bytesStore.get.mockResolvedValue({ kind: "found", value: raw })
      codec.decode.mockReturnValue("decoded")

      const res = await codecStore.get(key)

      expect(bytesStore.get).toHaveBeenCalledExactlyOnceWith(key)
      expect(codec.decode).toHaveBeenCalledExactlyOnceWith(raw)
      expect(res).toStrictEqual({ kind: "found", value: "decoded" })
    })
  })

  describe("set", () => {
    it("encodes value before writing to underlying BytesKeyValueStoreConditional", async () => {
      const key = "k:set"
      const value = "hello"
      const encoded = new Uint8Array([9, 9])

      codec.encode.mockReturnValue(encoded)

      await codecStore.set(key, value)

      expect(codec.encode).toHaveBeenCalledExactlyOnceWith(value)
      expect(bytesStore.set).toHaveBeenCalledExactlyOnceWith(key, encoded, undefined)
    })

    it("passes set options through unchanged", async () => {
      const key = "k:set:opts"
      const value = "hello"
      const encoded = new Uint8Array([1])
      const opts: KvSetOptions = { ttl: { kind: "milliseconds", milliseconds: 10 } }

      codec.encode.mockReturnValue(encoded)

      await codecStore.set(key, value, opts)

      expect(bytesStore.set).toHaveBeenCalledExactlyOnceWith(key, encoded, opts)
    })
  })

  describe("delete", () => {
    it("passes through to underlying BytesKeyValueStoreConditional", async () => {
      const key = "k:del"

      await codecStore.delete(key)

      expect(bytesStore.delete).toHaveBeenCalledExactlyOnceWith(key)
    })
  })

  describe("has", () => {
    it("returns true when underlying BytesKeyValueStoreConditional reports key exists", async () => {
      const key = "k:has:true"
      bytesStore.has.mockResolvedValue(true)

      const res = await codecStore.has(key)

      expect(bytesStore.has).toHaveBeenCalledExactlyOnceWith(key)
      expect(res).toBe(true)
    })

    it("returns false when underlying BytesKeyValueStoreConditional reports key does not exist", async () => {
      const key = "k:has:false"
      bytesStore.has.mockResolvedValue(false)

      const res = await codecStore.has(key)

      expect(bytesStore.has).toHaveBeenCalledExactlyOnceWith(key)
      expect(res).toBe(false)
    })
  })

  describe("getMany", () => {
    it("decodes only found entries; preserves not_found", async () => {
      const k1 = keys.one()
      const k2 = keys.two()
      const k3 = keys.three()

      const b1 = bytes.a()
      const b3 = bytes.c()

      bytesStore.getMany.mockResolvedValue(
        new Map([
          [k1, { kind: "found", value: b1 }],
          [k2, { kind: "not_found" }],
          [k3, { kind: "found", value: b3 }],
        ]),
      )

      codec.decode.mockReturnValueOnce("one").mockReturnValueOnce("three")

      const res = await codecStore.getMany([k1, k2, k3])

      expect(bytesStore.getMany).toHaveBeenCalledExactlyOnceWith([k1, k2, k3])

      expect(codec.decode).toHaveBeenCalledTimes(2)
      expect(codec.decode).toHaveBeenNthCalledWith(1, b1)
      expect(codec.decode).toHaveBeenNthCalledWith(2, b3)

      expect(res).toStrictEqual(
        new Map([
          [k1, { kind: "found", value: "one" }],
          [k2, { kind: "not_found" }],
          [k3, { kind: "found", value: "three" }],
        ]),
      )
    })

    it("preserves key order of the returned Map (same insertion order as underlying store map)", async () => {
      const keysIn = ["k:b", "k:a", "k:c"]

      bytesStore.getMany.mockResolvedValue(
        new Map([
          ["k:b", { kind: "not_found" }],
          ["k:a", { kind: "not_found" }],
          ["k:c", { kind: "not_found" }],
        ]),
      )

      const res = await codecStore.getMany(keysIn)

      const outKeys = Array.from(res.keys())
      expect(outKeys).toStrictEqual(keysIn)
    })
  })

  describe("setMany", () => {
    it("encodes all values before writing", async () => {
      const entries = [
        ["k:1", "one"],
        ["k:2", "two"],
      ] as const

      const b1 = new Uint8Array([1])
      const b2 = new Uint8Array([2])

      codec.encode.mockReturnValueOnce(b1).mockReturnValueOnce(b2)

      await codecStore.setMany(entries)

      expect(codec.encode).toHaveBeenCalledTimes(2)
      expect(codec.encode).toHaveBeenNthCalledWith(1, "one")
      expect(codec.encode).toHaveBeenNthCalledWith(2, "two")

      expect(bytesStore.setMany).toHaveBeenCalledExactlyOnceWith(
        [
          ["k:1", b1],
          ["k:2", b2],
        ],
        undefined,
      )
    })

    it("passes set options through unchanged", async () => {
      const entries = [["k:1", "one"]] as const
      const encoded = new Uint8Array([7])
      const opts: KvSetOptions = { ttl: { kind: "milliseconds", milliseconds: 1 } }

      codec.encode.mockReturnValue(encoded)

      await codecStore.setMany(entries, opts)

      expect(bytesStore.setMany).toHaveBeenCalledExactlyOnceWith([["k:1", encoded]], opts)
    })

    it("handles duplicate keys deterministically (documented semantics)", async () => {
      const entries = [
        ["k:dup", "first"],
        ["k:dup", "second"],
      ] as const

      const b1 = new Uint8Array([1])
      const b2 = new Uint8Array([2])

      codec.encode.mockReturnValueOnce(b1).mockReturnValueOnce(b2)

      await codecStore.setMany(entries)

      expect(bytesStore.setMany).toHaveBeenCalledTimes(1)
      expect(bytesStore.setMany).toHaveBeenCalledWith(
        [
          ["k:dup", b1],
          ["k:dup", b2],
        ],
        undefined,
      )
    })
  })

  describe("deleteMany", () => {
    it("passes through to underlying BytesKeyValueStoreConditional", async () => {
      const keysIn = ["k:1", "k:2"]

      await codecStore.deleteMany(keysIn)

      expect(bytesStore.deleteMany).toHaveBeenCalledExactlyOnceWith(keysIn)
    })
  })

  describe("setIfNotExists", () => {
    it("encodes value and passes options through to underlying BytesKeyValueStoreConditional", async () => {
      const key = "k:cond:ine"
      const value = "hello"
      const encoded = new Uint8Array([4, 5, 6])
      const opts: KvSetOptions = { ttl: { kind: "milliseconds", milliseconds: 99 } }
      const writeRes = { kind: "written" } as unknown as KvWriteResult

      codec.encode.mockReturnValue(encoded)
      bytesStore.setIfNotExists.mockResolvedValue(writeRes)

      const res = await codecStore.setIfNotExists(key, value, opts)

      expect(codec.encode).toHaveBeenCalledExactlyOnceWith(value)
      expect(bytesStore.setIfNotExists).toHaveBeenCalledExactlyOnceWith(
        key,
        encoded,
        opts,
      )
      expect(res).toBe(writeRes)
    })
  })

  describe("setIfExists", () => {
    it("encodes value and passes options through to underlying BytesKeyValueStoreConditional", async () => {
      const key = "k:cond:ie"
      const value = "hello"
      const encoded = new Uint8Array([7, 8, 9])
      const opts: KvSetOptions = { ttl: { kind: "milliseconds", milliseconds: 42 } }
      const writeRes = { kind: "written" } as unknown as KvWriteResult

      codec.encode.mockReturnValue(encoded)
      bytesStore.setIfExists.mockResolvedValue(writeRes)

      const res = await codecStore.setIfExists(key, value, opts)

      expect(codec.encode).toHaveBeenCalledExactlyOnceWith(value)
      expect(bytesStore.setIfExists).toHaveBeenCalledExactlyOnceWith(key, encoded, opts)
      expect(res).toBe(writeRes)
    })
  })

  describe("error propagation", () => {
    it("propagates codec.encode errors (does not swallow) for conditional writes", async () => {
      const err = new Error("encode failed")
      codec.encode.mockImplementation(() => {
        throw err
      })

      const promise = codecStore.setIfNotExists("k:1", "value")

      await expect(promise).rejects.toBe(err)
      expect(bytesStore.setIfNotExists).not.toHaveBeenCalled()
    })

    it("propagates underlying BytesKeyValueStoreConditional errors (does not swallow) for conditional writes", async () => {
      const err = new Error("bytes failed")
      bytesStore.setIfExists.mockRejectedValue(err)

      const promise = codecStore.setIfExists("k:1", "value")

      await expect(promise).rejects.toBe(err)
    })
  })
})
