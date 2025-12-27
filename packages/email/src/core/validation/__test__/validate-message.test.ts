import { describe, expect, it } from "vitest"
import type { EmailMessage } from "../../../ports/message"
import { validateMessage } from "../validate-message"

function validMessage(overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    from: { email: "sender@example.com" },
    to: { email: "recipient@example.com" },
    subject: "Test",
    text: "Hello",
    ...overrides,
  }
}

describe("validateMessage", () => {
  describe("content validation", () => {
    it("passes with text only", () => {
      expect(() => validateMessage(validMessage({ text: "Hello" }))).not.toThrow()
    })

    it("passes with html only", () => {
      expect(() => validateMessage(validMessage({ html: "<p>Hello</p>" }))).not.toThrow()
    })

    it("passes with both text and html", () => {
      expect(() =>
        validateMessage(validMessage({ text: "Hello", html: "<p>Hello</p>" })),
      ).not.toThrow()
    })

    it("throws when neither text nor html is provided", () => {
      const message = {
        from: { email: "sender@example.com" },
        to: { email: "recipient@example.com" },
        subject: "Test",
      } as unknown as EmailMessage

      expect(() => validateMessage(message)).toThrow(/text|html/i)
    })
  })

  describe("subject validation", () => {
    it("passes with a subject", () => {
      expect(() => validateMessage(validMessage({ subject: "Hello" }))).not.toThrow()
    })

    it("throws when subject is missing", () => {
      const message = {
        from: { email: "sender@example.com" },
        to: { email: "recipient@example.com" },
        text: "Hello",
      } as unknown as EmailMessage

      expect(() => validateMessage(message)).toThrow(/subject/i)
    })

    it("throws when subject is empty string", () => {
      const message = validMessage({ subject: "" })

      expect(() => validateMessage(message)).toThrow(/subject/i)
    })
  })

  describe("attachment validation", () => {
    it("passes with no attachments", () => {
      expect(() => validateMessage(validMessage())).not.toThrow()
    })

    it("passes with valid attachment", () => {
      const message = validMessage({
        attachments: [
          {
            filename: "test.txt",
            content: new Uint8Array([1, 2, 3]),
            contentType: "text/plain",
          },
        ],
      })

      expect(() => validateMessage(message)).not.toThrow()
    })

    it("passes with valid inline attachment", () => {
      const message = validMessage({
        attachments: [
          {
            filename: "logo.png",
            content: new Uint8Array([1, 2, 3]),
            contentType: "image/png",
            disposition: "inline",
            contentId: "logo123",
          },
        ],
      })

      expect(() => validateMessage(message)).not.toThrow()
    })

    it("throws when inline attachment is missing contentId", () => {
      const message = validMessage({
        attachments: [
          {
            filename: "logo.png",
            content: new Uint8Array([1, 2, 3]),
            contentType: "image/png",
            disposition: "inline",
          },
        ],
      }) as unknown as EmailMessage

      expect(() => validateMessage(message)).toThrow(/contentId/i)
    })

    it("throws when attachment is missing filename", () => {
      const message = validMessage({
        attachments: [
          {
            content: new Uint8Array([1, 2, 3]),
            contentType: "text/plain",
          } as any,
        ],
      }) as unknown as EmailMessage

      expect(() => validateMessage(message)).toThrow(/filename/i)
    })

    it("validates all attachments", () => {
      const message = validMessage({
        attachments: [
          {
            filename: "valid.txt",
            content: new Uint8Array([1, 2, 3]),
            contentType: "text/plain",
          },
          {
            filename: "invalid.png",
            content: new Uint8Array([1, 2, 3]),
            contentType: "image/png",
            disposition: "inline",
            // missing contentId
          },
        ],
      }) as unknown as EmailMessage

      expect(() => validateMessage(message)).toThrow(/contentId/i)
    })
  })
})
