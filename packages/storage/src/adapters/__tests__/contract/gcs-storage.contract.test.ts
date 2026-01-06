import type { Storage } from "@google-cloud/storage"
import { SystemClock } from "@subspace/clock"
import { describeStorageContractTests } from "../../../ports/__tests__/storage.contract"
import { createGcsTestClient } from "../../../tests/utils/create-gcs-test-client"
import { deleteGcsObjectsByPrefix } from "../../../tests/utils/delete-gcs-objects-by-prefix"
import { ensureGcsBucketExists } from "../../../tests/utils/ensure-gcs-bucket-exists"
import { GcsStorage } from "../../gcs-storage"

describe("GcsStorage (contract)", () => {
  let client: Storage
  let bucket: string
  let keyspacePrefix: string

  beforeAll(async () => {
    const setup = createGcsTestClient()

    client = setup.client
    bucket = setup.bucket
    keyspacePrefix = setup.keyspacePrefix

    await ensureGcsBucketExists(client, bucket)
  })

  afterAll(async () => {
    await deleteGcsObjectsByPrefix(client, bucket, keyspacePrefix)
  })

  describeStorageContractTests(
    "GcsStorage",
    async () => {
      const storage = new GcsStorage(
        { client, clock: new SystemClock() },
        { keyspacePrefix },
      )

      return { bucket, storage }
    },
    { supportsPagination: false },
  )
})
