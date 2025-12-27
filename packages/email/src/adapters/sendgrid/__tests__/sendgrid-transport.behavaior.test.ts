import { vi } from "vitest"
import type { EmailMessage } from "../../../ports/message"
import { SendGridTransport } from "../sendgrid-transport"

function createMockClient() {
  return {
    send: vi.fn().mockResolvedValue([
      {
        statusCode: 202,
        headers: { "x-message-id": "sg-mock-id-123" },
        body: "",
      },
      {},
    ]),
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

describe("SendGridTransport behavior", () => {
  it("throws when response missing x-message-id header", async () => {
    const client = createMockClient()

    client.send.mockResolvedValueOnce([{ statusCode: 202, headers: {}, body: "" }, {}])

    const transport = new SendGridTransport({ client: client as any })

    await expect(transport.send(minimalMessage())).rejects.toThrow(/message id/i)
  })

  it("maps sandboxMode option to mailSettings.sandboxMode", async () => {
    const client = createMockClient()
    const transport = new SendGridTransport({ client: client as any })

    await transport.send(minimalMessage(), { sandboxMode: true })

    expect(client.send).toHaveBeenCalledWith(
      expect.objectContaining({
        mailSettings: { sandboxMode: { enable: true } },
      }),
    )
  })

  it("maps sendAt option to sendAt field", async () => {
    const client = createMockClient()
    const transport = new SendGridTransport({ client: client as any })

    const sendAt = Math.floor(Date.now() / 1000) + 3600

    await transport.send(minimalMessage(), { sendAt })

    expect(client.send).toHaveBeenCalledWith(expect.objectContaining({ sendAt }))
  })

  it("maps trackOpens option to trackingSettings.openTracking", async () => {
    const client = createMockClient()
    const transport = new SendGridTransport({ client: client as any })

    await transport.send(minimalMessage(), { trackOpens: true })

    expect(client.send).toHaveBeenCalledWith(
      expect.objectContaining({
        trackingSettings: expect.objectContaining({
          openTracking: { enable: true },
        }),
      }),
    )
  })

  it("maps trackClicks option to trackingSettings.clickTracking", async () => {
    const client = createMockClient()
    const transport = new SendGridTransport({ client: client as any })

    await transport.send(minimalMessage(), { trackClicks: true })

    expect(client.send).toHaveBeenCalledWith(
      expect.objectContaining({
        trackingSettings: expect.objectContaining({
          clickTracking: { enable: true },
        }),
      }),
    )
  })

  it("maps tags array to categories", async () => {
    const client = createMockClient()
    const transport = new SendGridTransport({ client: client as any })

    await transport.send(minimalMessage({ tags: ["welcome", "onboarding"] }))

    expect(client.send).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: ["welcome", "onboarding"],
      }),
    )
  })

  it("maps addresses to { email, name } format", async () => {
    const client = createMockClient()
    const transport = new SendGridTransport({ client: client as any })

    await transport.send(
      minimalMessage({
        from: { email: "from@example.com", name: "From Name" },
        to: [{ email: "to1@example.com", name: "To One" }, { email: "to2@example.com" }],
      }),
    )

    expect(client.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { email: "from@example.com", name: "From Name" },
        to: [{ email: "to1@example.com", name: "To One" }, { email: "to2@example.com" }],
      }),
    )
  })

  it("base64 encodes attachment content", async () => {
    const client = createMockClient()
    const transport = new SendGridTransport({ client: client as any })

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

    const call = client.send.mock.calls[0]![0]

    expect(call.attachments[0].content).toBe(Buffer.from(content).toString("base64"))
    expect(call.attachments[0].filename).toBe("test.txt")
    expect(call.attachments[0].type).toBe("text/plain")
  })

  it("extracts messageId from x-message-id header", async () => {
    const client = createMockClient()
    client.send.mockResolvedValueOnce([
      { statusCode: 202, headers: { "x-message-id": "sg-id-123" }, body: "" },
      {},
    ])

    const transport = new SendGridTransport({ client: client as any })
    const result = await transport.send(minimalMessage())

    expect(result.messageId).toBe("sg-id-123")
  })

  it("calls validateMessage before sending", async () => {
    const client = createMockClient()
    const transport = new SendGridTransport({ client: client as any })

    const invalidMessage = {
      from: { email: "sender@example.com" },
      to: { email: "recipient@example.com" },
      subject: "No body",
    } as unknown as EmailMessage

    await expect(transport.send(invalidMessage)).rejects.toThrow(/text|html/i)
    expect(client.send).not.toHaveBeenCalled()
  })
})
