import { generateKeyPairSync, randomUUID } from "node:crypto"
import { Storage } from "@google-cloud/storage"

export function createGcsTestClient(): {
  client: Storage
  bucket: string
  keyspacePrefix: string
} {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  })

  const client = new Storage({
    apiEndpoint: process.env.GCS_ENDPOINT ?? "http://localhost:4444",
    projectId: "test-project",
    credentials: {
      client_email: "test@test-project.iam.gserviceaccount.com",
      private_key: privateKey,
    },
  })

  const bucket = process.env.GCS_BUCKET ?? "test-bucket"
  const keyspacePrefix = `subspace-gcs/${randomUUID()}/`

  return { client, bucket, keyspacePrefix }
}
