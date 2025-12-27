import type { EmailMessage } from "../../../ports/message"
import { createSesTestClient } from "../../../tests/utils/create-ses-test-client"
import { SesTransport } from "../ses-transport"

describe("SesTransport integration", () => {
  const client = createSesTestClient()
  const transport = new SesTransport({ client })

  const baseMessage: EmailMessage = {
    from: { email: "sender@example.com" },
    to: { email: "recipient@example.com" },
    subject: "Integration test",
    text: "Hello from SES integration test",
  }

  it("sends email successfully to ses", async () => {
    const result = await transport.send(baseMessage)

    expect(result.provider).toBe("ses")
    expect(typeof result.messageId).toBe("string")
    expect(result.messageId.length).toBeGreaterThan(0)
  })

  it("returns valid messageId from ses", async () => {
    const result = await transport.send(baseMessage)

    expect(result.messageId).toMatch(/.+/)
  })

  it("sends with configurationSetName without error", async () => {
    const result = await transport.send(baseMessage, {
      configurationSetName: "test-config-set",
    })

    expect(result.messageId).toBeDefined()
  })

  it("sends with attachments without error", async () => {
    const message: EmailMessage = {
      ...baseMessage,
      attachments: [
        {
          filename: "hello.txt",
          content: new TextEncoder().encode("hello"),
          contentType: "text/plain",
        },
      ],
    }

    const result = await transport.send(message)

    expect(result.messageId).toBeDefined()
  })
})
