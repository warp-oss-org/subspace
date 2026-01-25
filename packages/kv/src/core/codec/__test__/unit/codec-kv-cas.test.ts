import { mock } from "vitest-mock-extended"
import type { BytesKeyValueStoreCas } from "../../../../ports/bytes-kv-store"
import type { Codec } from "../../../../ports/codec"
import type { KvCasResult, KvResultVersioned, KvVersion } from "../../../../ports/kv-cas"
import type { KvSetOptions } from "../../../../ports/kv-options"
import type { Mock } from "../../../../tests/mock"
import { bytes, keys } from "../../../../tests/utils/kv-test-helpers"
import { CodecKeyValueStoreCas } from "../../codec-kv-cas"

describe("CodecKeyValueStoreCas<T>", () => {
  let bytesStore: Mock<BytesKeyValueStoreCas>
  let codec: Mock<Codec<string>>

  let codecStore: CodecKeyValueStoreCas<string>

  beforeEach(() => {
    bytesStore = mock<BytesKeyValueStoreCas>()
    codec = mock<Codec<string>>()

    codecStore = new CodecKeyValueStoreCas<string>({
      bytesStore,
      codec,
    })
  })

  describe("get", () => {
    it("returns not_found when underlying BytesKeyValueStoreCas misses (does not decode)", async () => {
      const key = "k:miss"
      bytesStore.get.mockResolvedValue({ kind: "not_found" })

      const res = await codecStore.get(key)

      expect(bytesStore.get).toHaveBeenCalledExactlyOnceWith(key)
      expect(codec.decode).not.toHaveBeenCalled()
      expect(res).toStrictEqual({ kind: "not_found" })
    })

    it("decodes bytes when underlying BytesKeyValueStoreCas hits", async () => {
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
    it("encodes value before writing to underlying BytesKeyValueStoreCas", async () => {
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
    it("passes through to underlying BytesKeyValueStoreCas", async () => {
      const key = "k:del"

      await codecStore.delete(key)

      expect(bytesStore.delete).toHaveBeenCalledExactlyOnceWith(key)
    })
  })

  describe("has", () => {
    it("returns true when underlying BytesKeyValueStoreCas reports key exists", async () => {
      const key = "k:has:true"
      bytesStore.has.mockResolvedValue(true)

      const res = await codecStore.has(key)

      expect(bytesStore.has).toHaveBeenCalledExactlyOnceWith(key)
      expect(res).toBe(true)
    })

    it("returns false when underlying BytesKeyValueStoreCas reports key does not exist", async () => {
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
    it("passes through to underlying BytesKeyValueStoreCas", async () => {
      const keysIn = ["k:1", "k:2"]

      await codecStore.deleteMany(keysIn)

      expect(bytesStore.deleteMany).toHaveBeenCalledExactlyOnceWith(keysIn)
    })
  })

  describe("getVersioned", () => {
    it("returns not_found when underlying store misses (does not decode)", async () => {
      const key = "k:ver:miss"
      bytesStore.getVersioned.mockResolvedValue({
        kind: "not_found",
      } as KvResultVersioned<Uint8Array>)

      const res = await codecStore.getVersioned(key)

      expect(bytesStore.getVersioned).toHaveBeenCalledExactlyOnceWith(key)
      expect(codec.decode).not.toHaveBeenCalled()
      expect(res).toStrictEqual({ kind: "not_found" })
    })

    it("decodes value and preserves version when underlying store hits", async () => {
      const key = "k:ver:hit"
      const raw = new Uint8Array([1, 2])
      const version = "v1" as unknown as KvVersion

      bytesStore.getVersioned.mockResolvedValue({
        kind: "found",
        value: raw,
        version,
      } as KvResultVersioned<Uint8Array>)
      codec.decode.mockReturnValue("decoded")

      const res = await codecStore.getVersioned(key)

      expect(bytesStore.getVersioned).toHaveBeenCalledExactlyOnceWith(key)
      expect(codec.decode).toHaveBeenCalledExactlyOnceWith(raw)
      expect(res).toStrictEqual({ kind: "found", value: "decoded", version })
    })
  })

  describe("setIfVersion", () => {
    it("encodes value and passes expectedVersion + options through to underlying BytesKeyValueStoreCas", async () => {
      const key = "k:cas:setIfVersion"
      const value = "hello"
      const encoded = new Uint8Array([4, 5, 6])
      const expectedVersion = "v42" as unknown as KvVersion
      const opts: KvSetOptions = { ttl: { kind: "milliseconds", milliseconds: 99 } }
      const casRes = { kind: "written" } as unknown as KvCasResult

      codec.encode.mockReturnValue(encoded)
      bytesStore.setIfVersion.mockResolvedValue(casRes)

      const res = await codecStore.setIfVersion(key, value, expectedVersion, opts)

      expect(codec.encode).toHaveBeenCalledExactlyOnceWith(value)
      expect(bytesStore.setIfVersion).toHaveBeenCalledExactlyOnceWith(
        key,
        encoded,
        expectedVersion,
        opts,
      )
      expect(res).toBe(casRes)
    })
  })

  describe("error propagation", () => {
    it("propagates codec.encode errors (does not swallow) for CAS writes", async () => {
      const err = new Error("encode failed")
      codec.encode.mockImplementation(() => {
        throw err
      })

      const promise = codecStore.setIfVersion(
        "k:1",
        "value",
        "v1" as unknown as KvVersion,
      )

      await expect(promise).rejects.toBe(err)
      expect(bytesStore.setIfVersion).not.toHaveBeenCalled()
    })

    it("propagates underlying BytesKeyValueStoreCas errors (does not swallow) for CAS writes", async () => {
      const err = new Error("bytes failed")
      bytesStore.setIfVersion.mockRejectedValue(err)

      const promise = codecStore.setIfVersion(
        "k:1",
        "value",
        "v1" as unknown as KvVersion,
      )

      await expect(promise).rejects.toBe(err)
    })
  })
})
