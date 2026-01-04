import { describeKvConditionalContract } from "../../../../ports/__tests__/kv-conditional.contract"
import { createRedisTestClient } from "../../../../tests/utils/create-redis-test-client"
import { deleteKeysByPrefix } from "../../../../tests/utils/delete-keys-by-prefix"
import { RedisBytesKeyValueStoreConditional } from "../../redis-bytes-kv-conditional"
import { RedisBytesKeyValueStore } from "../../redis-bytes-kv-store"
import type { RedisBytesClient } from "../../redis-client"

describe("RedisBytesKeyValueStoreConditional (contract)", () => {
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

  describeKvConditionalContract("RedisBytesKeyValueStoreConditional", () => {
    const baseStore = new RedisBytesKeyValueStore(client, {
      keyspacePrefix,
      batchSize: 1000,
    })

    return new RedisBytesKeyValueStoreConditional(
      { client, baseStore },
      { keyspacePrefix, batchSize: 1000 },
    )
  })
})
