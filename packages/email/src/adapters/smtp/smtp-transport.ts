import type { Transporter } from "nodemailer"
import type Mail from "nodemailer/lib/mailer"
import type SMTPTransport from "nodemailer/lib/smtp-transport"
import { validateMessage } from "../../core/validation/validate-message"
import type { EmailRecipient, EmailRecipients } from "../../ports/address"
import type { Attachment, EmailMessage } from "../../ports/message"
import type { SendResult } from "../../ports/transport"

export type SmtpSendOptions = {
  priority?: "high" | "normal" | "low"
  dsn?: {
    id?: string
    return?: "headers" | "full"
    notify?: ("success" | "failure" | "delay")[]
  }
}

export interface SmtpEmailTransport {
  send(message: EmailMessage, options?: SmtpSendOptions): Promise<SendResult>
}

export type SmtpTransportDeps = {
  client: Transporter
}

export class SmtpTransport implements SmtpEmailTransport {
  constructor(private readonly deps: SmtpTransportDeps) {}

  async send(message: EmailMessage, options?: SmtpSendOptions): Promise<SendResult> {
    validateMessage(message)

    const input = this.toMailOptions(message, options)

    const response: SMTPTransport.SentMessageInfo = await this.deps.client.sendMail(input)

    if (!response.messageId) {
      throw new Error("SMTP did not return a message ID")
    }

    const accepted = this.toStringArray(response.accepted)
    const rejected = this.toStringArray(response.rejected)

    return {
      provider: "smtp",
      messageId: response.messageId,
      ...(accepted && { accepted }),
      ...(rejected && { rejected }),
    }
  }

  private toMailOptions(message: EmailMessage, options?: SmtpSendOptions): Mail.Options {
    return {
      from: this.formatAddress(message.from),
      to: this.toAddressList(message.to),
      ...(message.cc && { cc: this.toAddressList(message.cc) }),
      ...(message.bcc && { bcc: this.toAddressList(message.bcc) }),
      ...(message.replyTo && { replyTo: this.formatAddress(message.replyTo) }),
      subject: message.subject,
      ...(message.text && { text: message.text }),
      ...(message.html && { html: message.html }),
      ...(message.headers && { headers: message.headers }),
      ...(message.attachments && {
        attachments: message.attachments.map((a) => this.toNodemailerAttachment(a)),
      }),
      ...(options?.priority && { priority: options.priority }),
      ...(options?.dsn && { dsn: options.dsn }),
    }
  }

  private toAddressList(recipients: EmailRecipients): string[] {
    const list = Array.isArray(recipients) ? recipients : [recipients]
    return list.map((r) => this.formatAddress(r))
  }

  private formatAddress(recipient: EmailRecipient): string {
    const address = typeof recipient === "string" ? { email: recipient } : recipient
    return address.name ? `${address.name} <${address.email}>` : address.email
  }

  private toNodemailerAttachment(attachment: Attachment): Mail.Attachment {
    return {
      filename: attachment.filename,
      content: Buffer.from(attachment.content),
      ...(attachment.contentType && { contentType: attachment.contentType }),
      ...(attachment.disposition && { contentDisposition: attachment.disposition }),
      ...(attachment.contentId && { cid: attachment.contentId }),
    }
  }

  private toStringArray(addresses: unknown): string[] | undefined {
    if (!Array.isArray(addresses)) return undefined

    return addresses
      .map((a) => {
        if (typeof a === "string") return a
        if (typeof a === "object" && a && "address" in a) return a.address

        return null
      })
      .filter((a): a is string => a !== null)
  }
}
