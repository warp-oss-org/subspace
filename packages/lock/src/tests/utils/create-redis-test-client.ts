import { randomUUID } from "node:crypto"
import { createRedisClient } from "../../adapters/redis/redis-client"

export function createRedisTestClient() {
  const keyspacePrefix = `test:lock:${randomUUID()}:`
  const url = process.env.REDIS_URL ?? "redis://localhost:16380"
  const client = createRedisClient({ url })

  return { client, keyspacePrefix }
}
