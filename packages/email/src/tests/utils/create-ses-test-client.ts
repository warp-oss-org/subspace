import { SESv2Client } from "@aws-sdk/client-sesv2"

export function createSesTestClient(): SESv2Client {
  return new SESv2Client({
    region: "us-east-1",
    endpoint: "http://localhost:4587",
    credentials: {
      accessKeyId: "test",
      secretAccessKey: "test",
    },
  })
}
