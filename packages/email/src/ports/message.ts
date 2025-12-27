import type { EmailRecipient, EmailRecipients } from "./address"

export type Attachment = {
  filename: string
  content: Uint8Array
  contentType?: string
  disposition?: "attachment" | "inline"
  contentId?: string
}

export type EmailContent =
  | { text: string; html?: string }
  | { text?: string; html: string }

export type EmailMessage = EmailContent & {
  to: EmailRecipients
  from: EmailRecipient

  cc?: EmailRecipients
  bcc?: EmailRecipients

  replyTo?: EmailRecipient

  subject: string

  headers?: Record<string, string>
  attachments?: Attachment[]

  /** Provider tags for analytics/categorization (best-effort mapping). */
  tags?: string[]

  /** Arbitrary key/value pairs passed through to provider (best-effort mapping). */
  metadata?: Record<string, string>

  idempotencyKey?: string
}
