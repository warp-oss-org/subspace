import type { EmailMessage } from "../../ports/message"

export function validateMessage(message: EmailMessage) {
  if (!message.text && !message.html) {
    throw new Error("EmailMessage requires at least one of text or html")
  }

  if (!message.subject) {
    throw new Error("EmailMessage requires a subject")
  }

  for (const a of message.attachments ?? []) {
    if (a.disposition === "inline" && !a.contentId) {
      throw new Error("Inline attachments require contentId")
    }

    if (!a.filename) {
      throw new Error("Attachments require a filename")
    }
  }
}
