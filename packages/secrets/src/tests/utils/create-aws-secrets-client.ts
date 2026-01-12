import { randomUUID } from "node:crypto"
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager"
import { SSMClient } from "@aws-sdk/client-ssm"

export function createSsmTestClient(): {
  client: SSMClient
  keyspacePrefix: string
} {
  const client = new SSMClient({
    region: process.env.AWS_REGION ?? "us-east-1",
    endpoint:
      process.env.SSM_ENDPOINT ?? process.env.AWS_ENDPOINT ?? "http://localhost:4568",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
    },
  })

  const keyspacePrefix = `subspace-ssm/${randomUUID()}/`

  return { client, keyspacePrefix }
}

export function createSecretsManagerTestClient(): {
  client: SecretsManagerClient
  keyspacePrefix: string
} {
  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION ?? "us-east-1",
    endpoint: process.env.AWS_ENDPOINT ?? "http://localhost:4568",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
    },
  })

  const keyspacePrefix = `subspace-secrets-manager/${randomUUID()}/`

  return { client, keyspacePrefix }
}
