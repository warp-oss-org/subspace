import type { Storage } from "@google-cloud/storage"

export async function ensureGcsBucketExists(
  client: Storage,
  bucketName: string,
): Promise<void> {
  const bucket = client.bucket(bucketName)

  const [exists] = await bucket.exists()
  if (exists) return

  await client.createBucket(bucketName)
}
