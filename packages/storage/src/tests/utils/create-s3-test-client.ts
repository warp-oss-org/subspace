import { randomUUID } from "node:crypto"
import { S3Client } from "@aws-sdk/client-s3"

export function createS3TestClient(): {
  client: S3Client
  bucket: string
  keyspacePrefix: string
} {
  const client = new S3Client({
    region: "us-east-1",
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:4567",
    credentials: {
      accessKeyId: "test",
      secretAccessKey: "test",
    },
    forcePathStyle: true,
  })

  const bucket = process.env.S3_BUCKET ?? "subspace-test-bucket"
  const keyspacePrefix = `subspace-s3/${randomUUID()}/`

  return { client, bucket, keyspacePrefix }
}
