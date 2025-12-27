import type { MailDataRequired, MailService } from "@sendgrid/mail"
import { validateMessage } from "../../core/validation/validate-message"
import type { EmailRecipient, EmailRecipients } from "../../ports/address"
import type { Attachment, EmailMessage } from "../../ports/message"
import type { SendResult } from "../../ports/transport"

/**
 * SendGrid-specific send options.
 * @see {@link https://docs.sendgrid.com/api-reference/mail-send/mail-send | Mail Send API}
 */
export type SendGridSendOptions = {
  /**
   * @see {@link https://docs.sendgrid.com/for-developers/sending-email/sandbox-mode | Sandbox Mode}
   */
  sandboxMode?: boolean

  /**
   * Unix timestamp for scheduled send.
   * @see {@link https://docs.sendgrid.com/for-developers/sending-email/scheduling-parameters | Scheduling Parameters}
   */
  sendAt?: number

  /**
   * @see {@link https://docs.sendgrid.com/ui/account-and-settings/tracking | Tracking Settings}
   */
  trackOpens?: boolean

  /**
   * @see {@link https://docs.sendgrid.com/ui/account-and-settings/tracking | Tracking Settings}
   */
  trackClicks?: boolean
}

export interface SendGridEmailTransport {
  send(message: EmailMessage, options?: SendGridSendOptions): Promise<SendResult>
}

export type SendGridTransportDeps = {
  client: MailService
}

export class SendGridTransport implements SendGridEmailTransport {
  constructor(private readonly deps: SendGridTransportDeps) {}

  async send(message: EmailMessage, options?: SendGridSendOptions): Promise<SendResult> {
    validateMessage(message)

    const input = this.toMailData(message, options)

    const [response] = await this.deps.client.send(input)

    const messageId = this.getHeader(response.headers, "x-message-id")

    if (!messageId) {
      throw new Error("SendGrid did not return a message ID")
    }

    return {
      provider: "sendgrid",
      messageId,
    }
  }

  private toMailData(
    message: EmailMessage,
    options?: SendGridSendOptions,
  ): MailDataRequired {
    return {
      from: this.toEmailData(message.from),
      to: this.toEmailDataList(message.to),
      ...(message.cc && { cc: this.toEmailDataList(message.cc) }),
      ...(message.bcc && { bcc: this.toEmailDataList(message.bcc) }),
      ...(message.replyTo && { replyTo: this.toEmailData(message.replyTo) }),
      subject: message.subject,
      ...(message.text && { text: message.text }),
      ...(message.html && { html: message.html }),
      ...(message.headers && { headers: message.headers }),
      ...(message.attachments && {
        attachments: message.attachments.map((a) => this.toSendGridAttachment(a)),
      }),
      ...(message.tags && { categories: message.tags }),
      ...(options?.sendAt && { sendAt: options.sendAt }),
      ...(options && this.toTrackingSettings(options)),
      ...(options?.sandboxMode && { mailSettings: { sandboxMode: { enable: true } } }),
    } as MailDataRequired
  }

  private toEmailData(recipient: EmailRecipient): { email: string; name?: string } {
    if (typeof recipient === "string") {
      return { email: recipient }
    }
    return { email: recipient.email, ...(recipient.name && { name: recipient.name }) }
  }

  private toEmailDataList(
    recipients: EmailRecipients,
  ): { email: string; name?: string }[] {
    const list = Array.isArray(recipients) ? recipients : [recipients]
    return list.map((r) => this.toEmailData(r))
  }

  private toSendGridAttachment(attachment: Attachment) {
    return {
      filename: attachment.filename,
      content: Buffer.from(attachment.content).toString("base64"),
      ...(attachment.contentType && { type: attachment.contentType }),
      ...(attachment.disposition && { disposition: attachment.disposition }),
      ...(attachment.contentId && { contentId: attachment.contentId }),
    }
  }

  private toTrackingSettings(options?: SendGridSendOptions) {
    if (!options) return undefined
    if (options.trackOpens === undefined && options.trackClicks === undefined) {
      return undefined
    }

    return {
      trackingSettings: {
        ...(options.trackOpens !== undefined && {
          openTracking: { enable: options.trackOpens },
        }),
        ...(options.trackClicks !== undefined && {
          clickTracking: { enable: options.trackClicks },
        }),
      },
    }
  }

  private getHeader(headers: Record<string, unknown>, name: string): string | undefined {
    const value =
      headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()]

    if (typeof value === "string") return value
    if (Array.isArray(value) && typeof value[0] === "string") return value[0]
    return undefined
  }
}
