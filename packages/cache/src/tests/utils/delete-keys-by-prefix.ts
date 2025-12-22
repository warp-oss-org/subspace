import type { RedisBytesClient } from "../../adapters/redis/redis-client"

export async function deleteKeysByPrefix(
  client: RedisBytesClient,
  prefix: string,
): Promise<void> {
  const keys = await client.keys(`${prefix}*`)
  if (keys.length > 0) {
    await client.unlink(...keys)
  }
}
