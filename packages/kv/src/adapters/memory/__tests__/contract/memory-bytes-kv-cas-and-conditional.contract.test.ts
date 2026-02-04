import { SystemClock } from "@subspace/clock"
import { describeKvCasContract } from "../../../../ports/__tests__/kv-cas.contract"
import { describeKvConditionalContract } from "../../../../ports/__tests__/kv-conditional.contract"
import { MemoryBytesKeyValueStoreCasConditional } from "../../memory-bytes-kv-cas-and-conditional"

describeKvCasContract("MemoryBytesKeyValueStoreCas", () => {
  return new MemoryBytesKeyValueStoreCasConditional(
    { clock: new SystemClock() },
    { maxEntries: 1000 },
  )
})

describeKvConditionalContract("MemoryBytesKeyValueStoreConditional", () => {
  return new MemoryBytesKeyValueStoreCasConditional(
    { clock: new SystemClock() },
    { maxEntries: 1000 },
  )
})
