import { vi } from "vitest"
import type { EmailMessage } from "../../../ports/message"
import { LinkTrackingOptions, PostmarkTransport } from "../postmark-transport"

function createMockClient() {
  return {
    sendEmail: vi.fn().mockResolvedValue({
      MessageID: "pm-mock-id-123",
      SubmittedAt: "2025-01-01T00:00:00Z",
      To: "recipient@example.com",
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

describe("PostmarkTransport behavior", () => {
  it("throws when Postmark returns no MessageID", async () => {
    const client = createMockClient()
    client.sendEmail.mockResolvedValueOnce({
      MessageID: undefined,
      SubmittedAt: "2025-01-01T00:00:00Z",
    })

    const transport = new PostmarkTransport({ client: client as any })

    await expect(transport.send(minimalMessage())).rejects.toThrow(/message id/i)
  })

  it("maps messageStream option to MessageStream", async () => {
    const client = createMockClient()
    const transport = new PostmarkTransport({ client: client as any })

    await transport.send(minimalMessage(), { messageStream: "outbound" })

    expect(client.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ MessageStream: "outbound" }),
    )
  })

  it("maps trackOpens option to TrackOpens", async () => {
    const client = createMockClient()
    const transport = new PostmarkTransport({ client: client as any })

    await transport.send(minimalMessage(), { trackOpens: true })

    expect(client.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ TrackOpens: true }),
    )
  })

  it("maps trackLinks option to TrackLinks enum value", async () => {
    const client = createMockClient()
    const transport = new PostmarkTransport({ client: client as any })

    await transport.send(minimalMessage(), {
      trackLinks: LinkTrackingOptions.HtmlAndText,
    })

    expect(client.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ TrackLinks: LinkTrackingOptions.HtmlAndText }),
    )
  })

  it("formats recipient list as comma-separated string", async () => {
    const client = createMockClient()
    const transport = new PostmarkTransport({ client: client as any })

    await transport.send(
      minimalMessage({
        to: [{ email: "a@example.com", name: "A" }, { email: "b@example.com" }],
      }),
    )

    expect(client.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        To: "A <a@example.com>, b@example.com",
      }),
    )
  })

  it("maps first tag to Tag field (single tag only)", async () => {
    const client = createMockClient()
    const transport = new PostmarkTransport({ client: client as any })

    await transport.send(minimalMessage({ tags: ["first-tag", "ignored-tag"] }))

    expect(client.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ Tag: "first-tag" }),
    )
  })

  it("maps metadata to Metadata field", async () => {
    const client = createMockClient()
    const transport = new PostmarkTransport({ client: client as any })

    await transport.send(
      minimalMessage({ metadata: { userId: "123", campaign: "welcome" } }),
    )

    expect(client.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        Metadata: { userId: "123", campaign: "welcome" },
      }),
    )
  })

  it("maps headers to Postmark Headers array format", async () => {
    const client = createMockClient()
    const transport = new PostmarkTransport({ client: client as any })

    await transport.send(
      minimalMessage({
        headers: {
          "X-Custom-One": "value1",
          "X-Custom-Two": "value2",
        },
      }),
    )

    expect(client.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        Headers: [
          { Name: "X-Custom-One", Value: "value1" },
          { Name: "X-Custom-Two", Value: "value2" },
        ],
      }),
    )
  })

  it("maps attachments with ContentID defaulting null", async () => {
    const client = createMockClient()
    const transport = new PostmarkTransport({ client: client as any })

    const content = new TextEncoder().encode("hello")

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

    const call = client.sendEmail.mock.calls[0]![0]

    expect(call.Attachments[0]).toEqual({
      Name: "test.txt",
      Content: Buffer.from(content).toString("base64"),
      ContentType: "text/plain",
      ContentID: null,
    })
  })

  it("maps attachments with contentId when provided", async () => {
    const client = createMockClient()
    const transport = new PostmarkTransport({ client: client as any })

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

    const call = client.sendEmail.mock.calls[0]![0]

    expect(call.Attachments[0].ContentID).toBe("logo123")
  })

  it("calls validateMessage before sending", async () => {
    const client = createMockClient()
    const transport = new PostmarkTransport({ client: client as any })

    const invalidMessage = {
      from: { email: "sender@example.com" },
      to: { email: "recipient@example.com" },
      subject: "No body",
    } as unknown as EmailMessage

    await expect(transport.send(invalidMessage)).rejects.toThrow(/text|html/i)
    expect(client.sendEmail).not.toHaveBeenCalled()
  })
})
