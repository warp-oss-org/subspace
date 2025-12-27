import type { EmailMessage } from "../message"
import type { EmailTransport, SendResult } from "../transport"

export type EmailTransportCapabilities = {
  supportsText?: boolean
  supportsHtml?: boolean
  supportsCc?: boolean
  supportsBcc?: boolean
  supportsReplyTo?: boolean
  supportsHeaders?: boolean
  supportsTags?: boolean
  supportsMetadata?: boolean
  supportsAttachments?: boolean
  supportsInlineAttachments?: boolean
  recordsAcceptedRejected?: boolean
}

const defaultCaps: Required<EmailTransportCapabilities> = {
  supportsText: true,
  supportsHtml: true,
  supportsCc: true,
  supportsBcc: true,
  supportsReplyTo: true,
  supportsHeaders: true,
  supportsTags: true,
  supportsMetadata: true,
  supportsAttachments: true,
  supportsInlineAttachments: true,
  recordsAcceptedRejected: false,
}

export type EmailTransportHarness = {
  name: string
  make: () => Promise<{
    transport: EmailTransport
    close?: () => Promise<void>
  }>
  capabilities?: () => EmailTransportCapabilities
}

export function describeEmailTransportContract(h: EmailTransportHarness) {
  const caps = { ...defaultCaps, ...(h.capabilities?.() ?? {}) }

  describe(`${h.name} (EmailTransport contract)`, () => {
    let transport: EmailTransport
    let close: (() => Promise<void>) | undefined

    beforeEach(async () => {
      const created = await h.make()

      transport = created.transport
      close = created.close
    })

    afterEach(async () => {
      await close?.()
    })

    describe("send", () => {
      it("returns a SendResult with provider and messageId", async () => {
        const message = minimalTextMessage()
        const result = await transport.send(message)

        assertSendResult(result)
      })

      it("does not mutate the input message", async () => {
        const message: EmailMessage = {
          ...minimalTextMessage(),
          headers: { "X-Test": "1" },
          tags: ["tag-a"],
          metadata: { userId: "123" },
          attachments: [
            {
              filename: "a.txt",
              content: new TextEncoder().encode("hello"),
              contentType: "text/plain",
            },
          ],
        }

        const before = JSON.stringify(message)

        await transport.send(message)

        expect(JSON.stringify(message)).toBe(before)
      })

      it.skipIf(!caps.supportsInlineAttachments)(
        "rejects inline attachments missing contentId",
        async () => {
          const message: EmailMessage = {
            from: { email: "sender@example.com" },
            to: { email: "recipient@example.com" },
            subject: "Inline missing cid",
            html: '<img src="cid:missing" />',
            attachments: [
              {
                filename: "logo.png",
                content: new Uint8Array([1, 2, 3]),
                contentType: "image/png",
                disposition: "inline",
                // contentId intentionally missing
              },
            ],
          }

          await expect(transport.send(message)).rejects.toThrow(
            /contentid|content-id|cid/i,
          )
        },
      )

      it.skipIf(!caps.supportsText)("sends with text body", async () => {
        const message: EmailMessage = {
          from: { email: "sender@example.com" },
          to: { email: "recipient@example.com" },
          subject: "Text only",
          text: "Plain text content",
        }

        const result = await transport.send(message)

        assertSendResult(result)
      })

      it.skipIf(!caps.supportsHtml)("sends with html body", async () => {
        const message: EmailMessage = {
          from: { email: "sender@example.com" },
          to: { email: "recipient@example.com" },
          subject: "HTML only",
          html: "<p>HTML content</p>",
        }

        const result = await transport.send(message)

        assertSendResult(result)
      })

      it.skipIf(!caps.supportsText || !caps.supportsHtml)(
        "sends with both text and html body",
        async () => {
          const message: EmailMessage = {
            from: { email: "sender@example.com" },
            to: { email: "recipient@example.com" },
            subject: "Both bodies",
            text: "Plain text",
            html: "<p>HTML</p>",
          }

          const result = await transport.send(message)

          assertSendResult(result)
        },
      )

      it("sends to multiple recipients", async () => {
        const message: EmailMessage = {
          from: { email: "sender@example.com" },
          to: [{ email: "r1@example.com" }, { email: "r2@example.com" }],
          subject: "Multiple recipients",
          text: "Hello all",
        }

        const result = await transport.send(message)

        assertSendResult(result)
      })

      it.skipIf(!caps.supportsCc || !caps.supportsBcc)(
        "sends with cc and bcc",
        async () => {
          const message: EmailMessage = {
            from: { email: "sender@example.com" },
            to: { email: "recipient@example.com" },
            cc: { email: "cc@example.com" },
            bcc: { email: "bcc@example.com" },
            subject: "With CC and BCC",
            text: "Content",
          }

          const result = await transport.send(message)

          assertSendResult(result)
        },
      )

      it.skipIf(!caps.supportsReplyTo)("sends with replyTo", async () => {
        const message: EmailMessage = {
          from: { email: "sender@example.com" },
          to: { email: "recipient@example.com" },
          replyTo: { email: "replies@example.com" },
          subject: "With reply-to",
          text: "Content",
        }

        const result = await transport.send(message)

        assertSendResult(result)
      })

      it("sends with named addresses", async () => {
        const message: EmailMessage = {
          from: { email: "sender@example.com", name: "Sender Name" },
          to: { email: "recipient@example.com", name: "Recipient Name" },
          subject: "Named addresses",
          text: "Content",
        }

        const result = await transport.send(message)

        assertSendResult(result)
      })

      it.skipIf(!caps.supportsHeaders)("sends with custom headers", async () => {
        const message: EmailMessage = {
          from: { email: "sender@example.com" },
          to: { email: "recipient@example.com" },
          subject: "Custom headers",
          text: "Content",
          headers: { "X-Custom-Header": "custom-value" },
        }

        const result = await transport.send(message)

        assertSendResult(result)
      })

      it.skipIf(!caps.supportsTags)("sends with tags", async () => {
        const message: EmailMessage = {
          from: { email: "sender@example.com" },
          to: { email: "recipient@example.com" },
          subject: "With tags",
          text: "Content",
          tags: ["transactional", "welcome"],
        }

        const result = await transport.send(message)

        assertSendResult(result)
      })

      it.skipIf(!caps.supportsMetadata)("sends with metadata", async () => {
        const message: EmailMessage = {
          from: { email: "sender@example.com" },
          to: { email: "recipient@example.com" },
          subject: "With metadata",
          text: "Content",
          metadata: { userId: "123", campaign: "onboarding" },
        }

        const result = await transport.send(message)

        assertSendResult(result)
      })

      it.skipIf(!caps.supportsAttachments)("sends with attachment", async () => {
        const message: EmailMessage = {
          from: { email: "sender@example.com" },
          to: { email: "recipient@example.com" },
          subject: "With attachment",
          text: "See attached",
          attachments: [
            {
              filename: "test.txt",
              content: new TextEncoder().encode("file content"),
              contentType: "text/plain",
            },
          ],
        }

        const result = await transport.send(message)

        assertSendResult(result)
      })

      it.skipIf(!caps.supportsInlineAttachments)(
        "sends with inline attachment",
        async () => {
          const message: EmailMessage = {
            from: { email: "sender@example.com" },
            to: { email: "recipient@example.com" },
            subject: "With inline image",
            html: '<p>Image: <img src="cid:logo123" /></p>',
            attachments: [
              {
                filename: "logo.png",
                content: new TextEncoder().encode("fake image data"),
                contentType: "image/png",
                disposition: "inline",
                contentId: "logo123",
              },
            ],
          }

          const result = await transport.send(message)

          assertSendResult(result)
        },
      )

      it.skipIf(!caps.recordsAcceptedRejected)(
        "includes accepted/rejected when transport records it",
        async () => {
          const message = minimalTextMessage()
          const result = await transport.send(message)

          if (result.accepted !== undefined) {
            expect(Array.isArray(result.accepted)).toBe(true)
            for (const a of result.accepted) expect(typeof a).toBe("string")
          }

          if (result.rejected !== undefined) {
            expect(Array.isArray(result.rejected)).toBe(true)
            for (const r of result.rejected) expect(typeof r).toBe("string")
          }
        },
      )
    })
  })
}

function assertSendResult(result: SendResult) {
  expect(result).toMatchObject({
    provider: expect.any(String),
    messageId: expect.any(String),
  })

  expect(result.provider.length).toBeGreaterThan(0)
  expect(result.messageId.length).toBeGreaterThan(0)
}

function minimalTextMessage(): EmailMessage {
  return {
    from: { email: "sender@example.com" },
    to: { email: "recipient@example.com" },
    subject: "Test",
    text: "Test content",
  }
}
