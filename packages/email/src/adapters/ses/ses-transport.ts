import type { SESv2Client, SendEmailCommandInput } from "@aws-sdk/client-sesv2"
import { SendEmailCommand } from "@aws-sdk/client-sesv2"
import { validateMessage } from "../../core/validation/validate-message"
import type { EmailRecipient, EmailRecipients } from "../../ports/address"
import type { Attachment, EmailMessage } from "../../ports/message"
import type { SendResult } from "../../ports/transport"

export type SesSendOptions = {
  configurationSetName?: string
  sourceArn?: string
  returnPath?: string
}

export interface SesEmailTransport {
  send(message: EmailMessage, options?: SesSendOptions): Promise<SendResult>
}

export type SesTransportDeps = {
  client: SESv2Client
}

type SesHeader = { Name: string; Value: string }
type SesEmailTag = { Name: string; Value: string }

export class SesTransport implements SesEmailTransport {
  constructor(private readonly deps: SesTransportDeps) {}

  async send(message: EmailMessage, options?: SesSendOptions): Promise<SendResult> {
    validateMessage(message)

    const input = this.toSendEmailInput(message, options)

    const response = await this.deps.client.send(new SendEmailCommand(input))

    if (!response.MessageId) {
      throw new Error("SES did not return a message ID")
    }

    return {
      provider: "ses",
      messageId: response.MessageId,
    }
  }

  private toSendEmailInput(
    message: EmailMessage,
    options?: SesSendOptions,
  ): SendEmailCommandInput {
    return {
      FromEmailAddress: this.formatAddress(message.from),
      ...(options?.sourceArn && { FromEmailAddressIdentityArn: options.sourceArn }),
      Destination: this.toSesDestination(message),
      ...(message.replyTo && {
        ReplyToAddresses: [this.formatAddress(message.replyTo)],
      }),
      Content: {
        Simple: this.toSesSimpleContent(message),
      },
      ...(options?.configurationSetName && {
        ConfigurationSetName: options.configurationSetName,
      }),
      ...(options?.returnPath && {
        FeedbackForwardingEmailAddress: options.returnPath,
      }),
      ...(message.tags && { EmailTags: this.toSesEmailTags(message.tags) }),
    }
  }

  private toSesDestination(
    message: EmailMessage,
  ): NonNullable<SendEmailCommandInput["Destination"]> {
    return {
      ToAddresses: this.toAddressList(message.to),
      ...(message.cc && { CcAddresses: this.toAddressList(message.cc) }),
      ...(message.bcc && { BccAddresses: this.toAddressList(message.bcc) }),
    }
  }

  private toSesSimpleContent(message: EmailMessage) {
    return {
      Subject: { Data: message.subject },
      Body: {
        ...(message.html && { Html: { Data: message.html } }),
        ...(message.text && { Text: { Data: message.text } }),
      },
      ...(message.headers && { Headers: this.toSesHeaders(message.headers) }),
      ...(message.attachments && {
        Attachments: message.attachments.map((a) => this.toSesAttachment(a)),
      }),
    }
  }

  private toSesEmailTags(tags: string[]): SesEmailTag[] {
    return tags.map((tag) => ({ Name: tag, Value: "true" }))
  }

  private toAddressList(recipients: EmailRecipients): string[] {
    const list = Array.isArray(recipients) ? recipients : [recipients]
    return list.map((r) => this.formatAddress(r))
  }

  private formatAddress(recipient: EmailRecipient): string {
    const address = typeof recipient === "string" ? { email: recipient } : recipient
    return address.name ? `${address.name} <${address.email}>` : address.email
  }

  private toSesAttachment(attachment: Attachment) {
    return {
      FileName: attachment.filename,
      RawContent: attachment.content,
      ContentType: attachment.contentType,
      ContentDisposition:
        attachment.disposition === "inline"
          ? ("INLINE" as const)
          : ("ATTACHMENT" as const),
      ContentId: attachment.contentId,
    }
  }

  private toSesHeaders(headers: Record<string, string>): SesHeader[] {
    return Object.entries(headers).map(([name, value]) => ({
      Name: name,
      Value: value,
    }))
  }
}
