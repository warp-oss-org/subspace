import { SystemClock } from "@subspace-kit/clock"
import { describeKvCasContract } from "../../../../ports/__tests__/kv-cas.contract"
import { MemoryBytesKeyValueStoreCas } from "../../memory-bytes-kv-cas"

describeKvCasContract("MemoryBytesKeyValueStoreCas", () => {
  return new MemoryBytesKeyValueStoreCas(
    { clock: new SystemClock() },
    { maxEntries: 1000 },
  )
})
