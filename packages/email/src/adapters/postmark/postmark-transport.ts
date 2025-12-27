import type { Message, ServerClient } from "postmark"
import { validateMessage } from "../../core/validation/validate-message"
import type { EmailRecipient, EmailRecipients } from "../../ports/address"
import type { Attachment, EmailMessage } from "../../ports/message"
import type { SendResult } from "../../ports/transport"

export enum LinkTrackingOptions {
  TextOnly = "TextOnly",
  HtmlOnly = "HtmlOnly",
  HtmlAndText = "HtmlAndText",
  None = "None",
}

/**
 * Postmark-specific send options.
 * @see {@link https://postmarkapp.com/developer/api/email-api | Email API}
 */
export type PostmarkSendOptions = {
  /**
   * @see {@link https://postmarkapp.com/developer/api/message-streams-api | Message Streams}
   */
  messageStream?: string

  /**
   * @see {@link https://postmarkapp.com/developer/api/email-api#send-a-single-email | Open Tracking}
   */
  trackOpens?: boolean

  /**
   * @see {@link https://postmarkapp.com/developer/api/email-api#send-a-single-email | Link Tracking}
   */
  trackLinks?: LinkTrackingOptions
}

export interface PostmarkEmailTransport {
  send(message: EmailMessage, options?: PostmarkSendOptions): Promise<SendResult>
}

export type PostmarkTransportDeps = {
  client: ServerClient
}

export class PostmarkTransport implements PostmarkEmailTransport {
  constructor(private readonly deps: PostmarkTransportDeps) {}

  async send(message: EmailMessage, options?: PostmarkSendOptions): Promise<SendResult> {
    validateMessage(message)

    const input = this.toPostmarkMessage(message, options)

    const response = await this.deps.client.sendEmail(input)

    if (!response.MessageID) {
      throw new Error("Postmark did not return a message ID")
    }

    return {
      provider: "postmark",
      messageId: response.MessageID,
    }
  }

  private toPostmarkMessage(
    message: EmailMessage,
    options?: PostmarkSendOptions,
  ): Message {
    return {
      From: this.formatAddress(message.from),
      To: this.toAddressList(message.to),
      ...(message.cc && { Cc: this.toAddressList(message.cc) }),
      ...(message.bcc && { Bcc: this.toAddressList(message.bcc) }),
      ...(message.replyTo && { ReplyTo: this.formatAddress(message.replyTo) }),
      Subject: message.subject,
      ...(message.text && { TextBody: message.text }),
      ...(message.html && { HtmlBody: message.html }),
      ...(message.headers && { Headers: this.toPostmarkHeaders(message.headers) }),
      ...(message.attachments && {
        Attachments: message.attachments.map((a) => this.toPostmarkAttachment(a)),
      }),
      ...(message.tags?.[0] && { Tag: message.tags[0] }),
      ...(message.metadata && { Metadata: message.metadata }),
      ...(options?.messageStream && { MessageStream: options.messageStream }),
      ...(options?.trackOpens !== undefined && { TrackOpens: options.trackOpens }),
      ...(options?.trackLinks !== undefined && { TrackLinks: options.trackLinks }),
    }
  }

  private toAddressList(recipients: EmailRecipients): string {
    const list = Array.isArray(recipients) ? recipients : [recipients]
    return list.map((r) => this.formatAddress(r)).join(", ")
  }

  private formatAddress(recipient: EmailRecipient): string {
    const address = typeof recipient === "string" ? { email: recipient } : recipient
    return address.name ? `${address.name} <${address.email}>` : address.email
  }

  private toPostmarkAttachment(attachment: Attachment) {
    return {
      Name: attachment.filename,
      Content: Buffer.from(attachment.content).toString("base64"),
      ContentType: attachment.contentType ?? "application/octet-stream",
      ContentID: attachment.contentId ?? null,
    }
  }

  private toPostmarkHeaders(headers: Record<string, string>) {
    return Object.entries(headers).map(([Name, Value]) => ({ Name, Value }))
  }
}
