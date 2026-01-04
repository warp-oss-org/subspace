import { describeKvStoreContract } from "../../../../ports/__tests__/kv-store.contract"
import { createRedisTestClient } from "../../../../tests/utils/create-redis-test-client"
import { deleteKeysByPrefix } from "../../../../tests/utils/delete-keys-by-prefix"
import { RedisBytesKeyValueStore } from "../../redis-bytes-kv-store"
import type { RedisBytesClient } from "../../redis-client"

describe("RedisBytesKeyValueStore (contract)", () => {
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

  describeKvStoreContract("RedisBytesKeyValueStore", () => {
    return new RedisBytesKeyValueStore(client, { keyspacePrefix, batchSize: 1000 })
  })
})
