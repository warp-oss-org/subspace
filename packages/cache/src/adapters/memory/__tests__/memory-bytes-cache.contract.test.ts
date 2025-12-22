import { LruMemoryMap } from "../../../core/eviction/lru-memory-map"
import { SystemClock } from "../../../core/time/clock"
import { runBytesCacheContractTests } from "../../../ports/__tests__/bytes-cache.contract"
import { MemoryBytesCache } from "../memory-bytes-cache"

runBytesCacheContractTests(
  "MemoryBytesCache",
  () =>
    new MemoryBytesCache(
      { clock: new SystemClock(), store: new LruMemoryMap() },
      { maxEntries: 100 },
    ),
)
