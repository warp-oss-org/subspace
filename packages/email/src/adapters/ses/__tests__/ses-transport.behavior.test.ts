import { vi } from "vitest"
import type { EmailMessage } from "../../../ports/message"
import { SesTransport } from "../ses-transport"

function createMockClient() {
  return {
    send: vi.fn().mockResolvedValue({
      MessageId: "ses-mock-id-123",
    }),
  }
}

function minimalMessage(overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    from: { email: "sender@example.com", name: "Sender" },
    to: { email: "recipient@example.com", name: "Recipient" },
    subject: "Test",
    text: "Hello",
    ...overrides,
  }
}

describe("SesTransport behavior", () => {
  it("throws when SES returns no MessageId", async () => {
    const client = createMockClient()
    client.send.mockResolvedValueOnce({ MessageId: undefined })

    const transport = new SesTransport({ client: client as any })

    await expect(transport.send(minimalMessage())).rejects.toThrow(/message id/i)
  })

  it("maps configurationSetName option to ConfigurationSetName", async () => {
    const client = createMockClient()
    const transport = new SesTransport({ client: client as any })

    await transport.send(minimalMessage(), { configurationSetName: "my-config-set" })

    const command = client.send.mock.calls[0]![0]

    expect(command.input.ConfigurationSetName).toBe("my-config-set")
  })

  it("maps sourceArn option to FromEmailAddressIdentityArn", async () => {
    const client = createMockClient()
    const transport = new SesTransport({ client: client as any })

    const arn = "arn:aws:ses:us-east-1:123456789:identity/example.com"
    await transport.send(minimalMessage(), { sourceArn: arn })

    const command = client.send.mock.calls[0]![0]

    expect(command.input.FromEmailAddressIdentityArn).toBe(arn)
  })

  it("maps returnPath option to FeedbackForwardingEmailAddress", async () => {
    const client = createMockClient()
    const transport = new SesTransport({ client: client as any })

    await transport.send(minimalMessage(), { returnPath: "bounces@example.com" })

    const command = client.send.mock.calls[0]![0]

    expect(command.input.FeedbackForwardingEmailAddress).toBe("bounces@example.com")
  })

  it("formats addresses with name as 'Name <email>'", async () => {
    const client = createMockClient()
    const transport = new SesTransport({ client: client as any })

    await transport.send(
      minimalMessage({
        from: { email: "from@example.com", name: "From Name" },
        to: { email: "to@example.com", name: "To Name" },
      }),
    )

    const command = client.send.mock.calls[0]![0]

    expect(command.input.FromEmailAddress).toBe("From Name <from@example.com>")
    expect(command.input.Destination.ToAddresses).toEqual(["To Name <to@example.com>"])
  })

  it("formats addresses without name as plain email", async () => {
    const client = createMockClient()
    const transport = new SesTransport({ client: client as any })

    await transport.send(
      minimalMessage({
        from: { email: "from@example.com" },
        to: { email: "to@example.com" },
      }),
    )

    const command = client.send.mock.calls[0]![0]
    expect(command.input.FromEmailAddress).toBe("from@example.com")
    expect(command.input.Destination.ToAddresses).toEqual(["to@example.com"])
  })

  it("maps tags array to EmailTags with Value='true'", async () => {
    const client = createMockClient()
    const transport = new SesTransport({ client: client as any })

    await transport.send(minimalMessage({ tags: ["welcome", "onboarding"] }))

    const command = client.send.mock.calls[0]![0]

    expect(command.input.EmailTags).toEqual([
      { Name: "welcome", Value: "true" },
      { Name: "onboarding", Value: "true" },
    ])
  })

  it("maps headers to SES Headers array format", async () => {
    const client = createMockClient()
    const transport = new SesTransport({ client: client as any })

    await transport.send(
      minimalMessage({
        headers: {
          "X-Custom-One": "value1",
          "X-Custom-Two": "value2",
        },
      }),
    )

    const command = client.send.mock.calls[0]![0]

    expect(command.input.Content.Simple.Headers).toEqual([
      { Name: "X-Custom-One", Value: "value1" },
      { Name: "X-Custom-Two", Value: "value2" },
    ])
  })

  it("maps attachments to SES Attachments format", async () => {
    const client = createMockClient()
    const transport = new SesTransport({ client: client as any })

    const content = new TextEncoder().encode("hello attachment")

    await transport.send(
      minimalMessage({
        attachments: [
          {
            filename: "test.txt",
            content,
            contentType: "text/plain",
          },
        ],
      }),
    )

    const command = client.send.mock.calls[0]![0]

    const attachment = command.input.Content.Simple.Attachments[0]

    expect(attachment.FileName).toBe("test.txt")
    expect(attachment.ContentType).toBe("text/plain")
    expect(attachment.RawContent).toEqual(content)
  })

  it("maps inline attachments with ContentDisposition and ContentId", async () => {
    const client = createMockClient()
    const transport = new SesTransport({ client: client as any })

    await transport.send(
      minimalMessage({
        html: '<img src="cid:logo123" />',
        attachments: [
          {
            filename: "logo.png",
            content: new Uint8Array([1, 2, 3]),
            contentType: "image/png",
            disposition: "inline",
            contentId: "logo123",
          },
        ],
      }),
    )

    const command = client.send.mock.calls[0]![0]

    const attachment = command.input.Content.Simple.Attachments[0]

    expect(attachment.ContentDisposition).toBe("INLINE")
    expect(attachment.ContentId).toBe("logo123")
  })

  it("calls validateMessage before sending", async () => {
    const client = createMockClient()
    const transport = new SesTransport({ client: client as any })

    const invalidMessage = {
      from: { email: "sender@example.com" },
      to: { email: "recipient@example.com" },
      subject: "No body",
    } as unknown as EmailMessage

    await expect(transport.send(invalidMessage)).rejects.toThrow(/text|html/i)
    expect(client.send).not.toHaveBeenCalled()
  })
})
