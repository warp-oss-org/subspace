import { LruMemoryMap } from "../lru-memory-map"
import { runEvictionMapContractTests } from "./eviction-map"

describe("LruMemoryMap", () => {
  runEvictionMapContractTests("LruMemoryMap", () => new LruMemoryMap<string, unknown>())
})
