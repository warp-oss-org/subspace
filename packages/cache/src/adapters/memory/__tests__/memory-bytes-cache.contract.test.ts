import { LruMemoryMap } from "../../../core/eviction/lru-memory-map"
import { SystemClock } from "../../../core/time/clock"
import { describeCacheContract } from "../../../ports/__tests__/bytes-cache.contract"
import { MemoryBytesCache } from "../memory-bytes-cache"

describeCacheContract(
  "MemoryBytesCache",
  () =>
    new MemoryBytesCache(
      { clock: new SystemClock(), store: new LruMemoryMap() },
      { maxEntries: 100 },
    ),
)
