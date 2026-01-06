import { SystemClock } from "@subspace/clock"
import { describeStorageContractTests } from "../../../ports/__tests__/storage.contract"
import { MemoryStorage } from "../../memory-storage"

describeStorageContractTests("Memory", async () => {
  const storage = new MemoryStorage({ clock: new SystemClock() })
  const bucket = "test-bucket"

  return { bucket, storage }
})
