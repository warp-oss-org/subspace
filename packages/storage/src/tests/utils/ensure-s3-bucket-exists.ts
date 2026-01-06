import { CreateBucketCommand, HeadBucketCommand, type S3Client } from "@aws-sdk/client-s3"

export async function ensureS3BucketExists(
  client: S3Client,
  bucket: string,
): Promise<void> {
  try {
    await client.send(
      new HeadBucketCommand({
        Bucket: bucket,
      }),
    )
  } catch {
    await client.send(
      new CreateBucketCommand({
        Bucket: bucket,
      }),
    )
  }
}
