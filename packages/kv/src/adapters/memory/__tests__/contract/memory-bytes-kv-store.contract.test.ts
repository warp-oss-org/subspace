import { SystemClock } from "@subspace-kit/clock"
import { describeKvStoreContract } from "../../../../ports/__tests__/kv-store.contract"
import { MemoryBytesKeyValueStore } from "../../memory-bytes-kv-store"

describeKvStoreContract("MemoryBytesKeyValueStore", () => {
  return new MemoryBytesKeyValueStore({ clock: new SystemClock() }, { maxEntries: 1000 })
})
