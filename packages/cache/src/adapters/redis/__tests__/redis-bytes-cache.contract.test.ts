import { runBytesCacheContractTests } from "../../../ports/__tests__/bytes-cache.contract"
import { createRedisTestClient } from "../../../tests/utils/create-redis-test-client"
import { deleteKeysByPrefix } from "../../../tests/utils/delete-keys-by-prefix"
import { RedisBytesCache } from "../redis-bytes-cache"
import type { RedisBytesClient } from "../redis-client"

describe("RedisBytesCache (contract)", () => {
  let keyspacePrefix: string
  let client: RedisBytesClient

  beforeAll(async () => {
    const redisTestClient = createRedisTestClient()

    client = redisTestClient.client
    keyspacePrefix = redisTestClient.keyspacePrefix

    await client.connect()
  })

  afterAll(async () => {
    await client.quit()
  })

  beforeEach(async () => {
    await deleteKeysByPrefix(client, keyspacePrefix)
  })

  runBytesCacheContractTests("RedisBytesCache", () => {
    return new RedisBytesCache(client, { keyspacePrefix, batchSize: 1000 })
  })
})
