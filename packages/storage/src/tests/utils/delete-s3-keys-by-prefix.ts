import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  type S3Client,
} from "@aws-sdk/client-s3"

export async function deleteS3KeysByPrefix(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<void> {
  let continuationToken: string | undefined

  do {
    const list = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    )

    const objects = list.Contents?.map((o) => ({ Key: o.Key! })) ?? []

    if (objects.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: objects,
            Quiet: true,
          },
        }),
      )
    }

    continuationToken = list.NextContinuationToken
  } while (continuationToken)
}
