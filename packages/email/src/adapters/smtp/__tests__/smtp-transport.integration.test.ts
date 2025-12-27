import type { EmailMessage } from "../../../ports/message"
import { createSmtpTestClient } from "../../../tests/utils/create-smtp-test-client"
import { SmtpTransport } from "../smtp-transport"

const MAILPIT_API = "http://localhost:8026/api/v1"

describe("SmtpTransport integration", () => {
  const client = createSmtpTestClient({ mode: "real-smtp" })
  const transport = new SmtpTransport({ client })

  const baseMessage: EmailMessage = {
    from: { email: "sender@example.com", name: "Sender" },
    to: { email: "recipient@example.com", name: "Recipient" },
    subject: "SMTP integration test",
    text: "Hello from SMTP integration test",
    html: "<p>Hello from <b>SMTP</b> integration test</p>",
  }

  afterAll(async () => {
    await fetch(`${MAILPIT_API}/messages`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [] }),
    })
  })

  it("sends email and appears in Mailpit inbox", async () => {
    const result = await transport.send(baseMessage)

    expect(result.messageId).toBeDefined()

    const message = await findMessageByMessageId(result.messageId)

    expect(message).toBeDefined()
    expect(message.Subject).toBe(baseMessage.subject)
  })

  it("sends email with attachment retrievable from Mailpit", async () => {
    const message: EmailMessage = {
      ...baseMessage,
      subject: "With attachment",
      attachments: [
        {
          filename: "test.txt",
          content: new TextEncoder().encode("hello attachment"),
          contentType: "text/plain",
        },
      ],
    }

    const result = await transport.send(message)
    const full = await getMessageByMessageId(result.messageId)

    expect(full.Attachments.length).toBe(1)
    expect(full.Attachments[0].FileName).toBe("test.txt")
  })

  it("sends email with inline image", async () => {
    const message: EmailMessage = {
      ...baseMessage,
      subject: "With inline image",
      html: '<p><img src="cid:logo123" /></p>',
      attachments: [
        {
          filename: "logo.png",
          content: new Uint8Array([1, 2, 3]),
          contentType: "image/png",
          disposition: "inline",
          contentId: "logo123",
        },
      ],
    }

    const result = await transport.send(message)
    const full = await getMessageByMessageId(result.messageId)

    const inline = full.Inline?.find((a: any) => a.ContentID === "logo123")
    expect(inline).toBeDefined()
    expect(inline.FileName).toBe("logo.png")
  })

  it("sends to multiple recipients", async () => {
    const message: EmailMessage = {
      ...baseMessage,
      subject: "Multiple recipients",
      to: [{ email: "a@example.com" }, { email: "b@example.com" }],
    }

    const result = await transport.send(message)
    const found = await findMessageByMessageId(result.messageId)

    expect(found.To.length).toBe(2)
  })

  it("sends with cc", async () => {
    const message: EmailMessage = {
      ...baseMessage,
      subject: "With CC",
      cc: { email: "cc@example.com" },
    }

    const result = await transport.send(message)
    const found = await findMessageByMessageId(result.messageId)

    expect(found.Cc.some((r: any) => r.Address === "cc@example.com")).toBe(true)
  })

  it("sends with bcc without error", async () => {
    const message: EmailMessage = {
      ...baseMessage,
      subject: "With BCC",
      bcc: { email: "bcc@example.com" },
    }

    const result = await transport.send(message)
    expect(result.messageId).toBeDefined()
  })

  it("includes custom headers", async () => {
    const message: EmailMessage = {
      ...baseMessage,
      subject: "With headers",
      headers: { "X-Custom-Test": "yes" },
    }

    const result = await transport.send(message)
    const headers = await getMessageHeadersByMessageId(result.messageId)

    expect(headers["X-Custom-Test"]).toContain("yes")
  })
})

async function findMessageByMessageId(messageId: string) {
  const messages = await getMessages()
  const found = messages.find(
    (m: any) =>
      m.MessageID === messageId ||
      m.MessageID === `<${messageId}>` ||
      `<${m.MessageID}>` === messageId,
  )
  if (!found) throw new Error(`Message not found: ${messageId}`)
  return found
}

async function getMessageByMessageId(messageId: string) {
  const summary = await findMessageByMessageId(messageId)
  return getMessage(summary.ID)
}

async function getMessageHeadersByMessageId(messageId: string) {
  const summary = await findMessageByMessageId(messageId)
  return getMessageHeaders(summary.ID)
}

async function getMessages() {
  const res = await fetch(`${MAILPIT_API}/messages`)
  const data = (await res.json()) as any
  return data.messages
}

async function getMessage(id: string): Promise<any> {
  const res = await fetch(`${MAILPIT_API}/message/${id}`)
  return res.json()
}

async function getMessageHeaders(id: string): Promise<Record<string, string[]>> {
  const res = await fetch(`${MAILPIT_API}/message/${id}/headers`)
  return res.json() as any
}
