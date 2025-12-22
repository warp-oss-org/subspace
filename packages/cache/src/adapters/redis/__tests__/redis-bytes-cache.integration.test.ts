import { createRedisTestClient } from "../../../tests/utils/create-redis-test-client"
import { deleteKeysByPrefix } from "../../../tests/utils/delete-keys-by-prefix"
import type { RedisBytesClient } from "../redis-client"

describe("RedisBytesCache (integration)", () => {
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

  describe("keyspace wiring", () => {
    it("applies keyspacePrefix to all operations", async () => {})

    it("does not double-prefix keys", async () => {})
  })

  describe("TTL integration", () => {
    it("TTL is persisted at Redis level (sanity)", async () => {})

    it("until-date in the past results in immediate miss", async () => {})

    it("writing without TTL clears any existing TTL", async () => {})
  })

  describe("bulk ops", () => {
    it("setMany writes all entries within a MULTI/EXEC batch", async () => {})

    it("invalidateMany handles large key counts without throwing", async () => {})
  })
})
