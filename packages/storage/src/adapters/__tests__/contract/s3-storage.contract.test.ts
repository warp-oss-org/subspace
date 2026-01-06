import type { S3Client } from "@aws-sdk/client-s3"
import { SystemClock } from "@subspace/clock"
import { describeStorageContractTests } from "../../../ports/__tests__/storage.contract"
import { createS3TestClient } from "../../../tests/utils/create-s3-test-client"
import { deleteS3KeysByPrefix } from "../../../tests/utils/delete-s3-keys-by-prefix"
import { ensureS3BucketExists } from "../../../tests/utils/ensure-s3-bucket-exists"
import { S3Storage } from "../../s3-storage"

describe("S3Storage (contract)", () => {
  let client: S3Client
  let bucket: string
  let keyspacePrefix: string

  beforeAll(async () => {
    const setup = createS3TestClient()

    client = setup.client
    bucket = setup.bucket
    keyspacePrefix = setup.keyspacePrefix

    await ensureS3BucketExists(client, bucket)
  })

  afterAll(async () => {
    await deleteS3KeysByPrefix(client, bucket, keyspacePrefix)
    client.destroy()
  })

  describeStorageContractTests("S3Storage", async () => {
    const storage = new S3Storage(
      { client, clock: new SystemClock() },
      { keyspacePrefix },
    )

    return { bucket, storage }
  })
})
