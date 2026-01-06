import { mkdtemp, rm } from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { describeStorageContractTests } from "../../../ports/__tests__/storage.contract"
import { FileSystemStorage } from "../../fs-storage"

describe("FileSystemStorage (contract)", () => {
  let tempDir: string

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "subspace-fs-contract-"))
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true })
  })

  describeStorageContractTests("FileSystemStorage", async () => {
    const bucket = "test-bucket"
    const storage = new FileSystemStorage({ rootDir: tempDir })

    return { bucket, storage }
  })
})
