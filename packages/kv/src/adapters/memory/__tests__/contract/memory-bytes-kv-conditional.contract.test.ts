import { SystemClock } from "@subspace/clock"
import { describeKvConditionalContract } from "../../../../ports/__tests__/kv-conditional.contract"
import { MemoryBytesKeyValueStoreConditional } from "../../memory-bytes-kv-conditional"

describeKvConditionalContract("MemoryBytesKeyValueStoreConditional", () => {
  return new MemoryBytesKeyValueStoreConditional(
    { clock: new SystemClock() },
    { maxEntries: 1000 },
  )
})
