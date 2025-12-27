import { vi } from "vitest"
import type { EmailMessage } from "../../../ports/message"
import { SmtpTransport } from "../smtp-transport"

function createMockClient() {
  return {
    sendMail: vi.fn().mockResolvedValue({
      messageId: "mock-id-123",
      accepted: ["recipient@example.com"],
      rejected: [],
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

describe("SmtpTransport behavior", () => {
  it("throws when nodemailer returns no messageId", async () => {
    const client = createMockClient()
    client.sendMail.mockResolvedValueOnce({ messageId: undefined })

    const transport = new SmtpTransport({ client: client as any })

    await expect(transport.send(minimalMessage())).rejects.toThrow(/message id/i)
  })

  it("maps priority option to nodemailer priority field", async () => {
    const client = createMockClient()
    const transport = new SmtpTransport({ client: client as any })

    await transport.send(minimalMessage(), { priority: "high" })

    expect(client.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ priority: "high" }),
    )
  })

  it("maps dsn option to nodemailer dsn field", async () => {
    const client = createMockClient()
    const transport = new SmtpTransport({ client: client as any })

    await transport.send(minimalMessage(), {
      dsn: {
        id: "abc",
        return: "headers",
        notify: ["success", "failure"],
      },
    })

    expect(client.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: {
          id: "abc",
          return: "headers",
          notify: ["success", "failure"],
        },
      }),
    )
  })

  it("formats addresses with name as 'Name <email>'", async () => {
    const client = createMockClient()
    const transport = new SmtpTransport({ client: client as any })

    await transport.send(
      minimalMessage({
        from: { email: "from@example.com", name: "From Name" },
        to: { email: "to@example.com", name: "To Name" },
      }),
    )

    expect(client.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "From Name <from@example.com>",
        to: ["To Name <to@example.com>"],
      }),
    )
  })

  it("formats addresses without name as plain email", async () => {
    const client = createMockClient()
    const transport = new SmtpTransport({ client: client as any })

    await transport.send(
      minimalMessage({
        from: { email: "from@example.com" },
        to: { email: "to@example.com" },
      }),
    )

    expect(client.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "from@example.com",
        to: ["to@example.com"],
      }),
    )
  })

  it("converts attachments to nodemailer format with Buffer content", async () => {
    const client = createMockClient()
    const transport = new SmtpTransport({ client: client as any })

    await transport.send(
      minimalMessage({
        attachments: [
          {
            filename: "a.txt",
            content: new Uint8Array([1, 2, 3]),
            contentType: "text/plain",
          },
        ],
      }),
    )

    const call = client.sendMail.mock.calls[0]![0]

    expect(call.attachments).toHaveLength(1)
    expect(Buffer.isBuffer(call.attachments[0].content)).toBe(true)
    expect(call.attachments[0].filename).toBe("a.txt")
    expect(call.attachments[0].contentType).toBe("text/plain")
  })

  it("sets attachment cid from contentId", async () => {
    const client = createMockClient()
    const transport = new SmtpTransport({ client: client as any })

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

    const call = client.sendMail.mock.calls[0]![0]

    expect(call.attachments[0].cid).toBe("logo123")
  })

  it("extracts accepted/rejected from nodemailer response", async () => {
    const client = createMockClient()
    client.sendMail.mockResolvedValueOnce({
      messageId: "id-123",
      accepted: ["a@example.com"],
      rejected: ["b@example.com"],
    })

    const transport = new SmtpTransport({ client: client as any })
    const result = await transport.send(minimalMessage())

    expect(result.provider).toBe("smtp")
    expect(result.messageId).toBe("id-123")
    expect(result.accepted).toEqual(["a@example.com"])
    expect(result.rejected).toEqual(["b@example.com"])
  })

  it("calls validateMessage before sending", async () => {
    const client = createMockClient()
    const transport = new SmtpTransport({ client: client as any })

    const invalidMessage = {
      from: { email: "sender@example.com" },
      to: { email: "recipient@example.com" },
      subject: "No body",
      // missing text and html
    } as unknown as EmailMessage

    await expect(transport.send(invalidMessage)).rejects.toThrow(/text|html/i)

    expect(client.sendMail).not.toHaveBeenCalled()
  })
})
