import { FifoMemoryMap } from "../fifo-memory-map"
import { runEvictionMapContractTests } from "./eviction-map"

describe("FifoMemoryMap", () => {
  runEvictionMapContractTests("FifoMemoryMap", () => new FifoMemoryMap<string, unknown>())
})
