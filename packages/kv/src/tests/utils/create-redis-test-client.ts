import { randomUUID } from "node:crypto"
import { createRedisClient } from "../../adapters/redis/create"

export function createRedisTestClient() {
  const keyspacePrefix = `test:cache:${randomUUID()}:`
  const url = process.env.REDIS_URL ?? "redis://localhost:16381"
  const client = createRedisClient({ url })

  return { client, keyspacePrefix }
}
