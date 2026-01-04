import type { RedisBytesClient } from "../../adapters/redis/redis-client"

export async function deleteKeysByPrefix(
  client: RedisBytesClient,
  prefix: string,
): Promise<void> {
  const keys = await getKeysByPrefix(client, prefix)

  if (keys.length > 0) {
    await client.del(keys)
  }
}

export async function getKeysByPrefix(
  client: RedisBytesClient,
  prefix: string,
): Promise<string[]> {
  const rawKeys = await client.keys(`${prefix}*`)

  return bufferKeysAsStrings(rawKeys)
}

function bufferKeysAsStrings(rawKeys: Array<Buffer | string>): string[] {
  return rawKeys
    .map((k) => (Buffer.isBuffer(k) ? k.toString("utf8") : k))
    .filter((k): k is string => typeof k === "string" && k.length > 0)
}
