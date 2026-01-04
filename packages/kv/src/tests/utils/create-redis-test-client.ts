import { randomUUID } from "node:crypto"
import { createRedisBytesClient } from "../../adapters/redis/redis-client"

export function createRedisTestClient() {
  const keyspacePrefix = `test:cache:${randomUUID()}:`
  const url = process.env.REDIS_URL ?? "redis://localhost:16381"
  const client = createRedisBytesClient(url)

  return { client, keyspacePrefix }
}
