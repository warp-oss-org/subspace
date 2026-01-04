import { describeKvCasContract } from "../../../../ports/__tests__/kv-cas.contract"
import { createRedisTestClient } from "../../../../tests/utils/create-redis-test-client"
import { deleteKeysByPrefix } from "../../../../tests/utils/delete-keys-by-prefix"
import { RedisBytesKeyValueStoreCas } from "../../redis-bytes-kv-cas"
import type { RedisBytesClient } from "../../redis-client"

describe("RedisBytesKeyValueStoreCas (contract)", () => {
  let keyspacePrefix: string
  let client: RedisBytesClient

  beforeAll(async () => {
    const redisTestClient = createRedisTestClient()

    client = redisTestClient.client
    keyspacePrefix = redisTestClient.keyspacePrefix

    await client.connect()
  })

  afterEach(async () => {
    await deleteKeysByPrefix(client, keyspacePrefix)
  })

  afterAll(async () => {
    await client.quit()
  })

  describeKvCasContract("RedisBytesKeyValueStoreCas", () => {
    return new RedisBytesKeyValueStoreCas({ client }, { keyspacePrefix, batchSize: 1000 })
  })
})
