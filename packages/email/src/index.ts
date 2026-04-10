export {
  LinkTrackingOptions,
  type PostmarkEmailTransport,
  type PostmarkSendOptions,
  PostmarkTransport,
  type PostmarkTransportDeps,
} from "./adapters/postmark/postmark-transport"
export {
  type SendGridEmailTransport,
  type SendGridSendOptions,
  SendGridTransport,
  type SendGridTransportDeps,
} from "./adapters/sendgrid/sendgrid-transport"
export {
  type SesEmailTransport,
  type SesSendOptions,
  SesTransport,
  type SesTransportDeps,
} from "./adapters/ses/ses-transport"
export {
  type SmtpEmailTransport,
  type SmtpSendOptions,
  SmtpTransport,
  type SmtpTransportDeps,
} from "./adapters/smtp/smtp-transport"
export { validateMessage } from "./core/validation/validate-message"
export type { EmailAddress, EmailRecipient, EmailRecipients } from "./ports/address"
export type { Attachment, EmailContent, EmailMessage } from "./ports/message"
export type { EmailTransport, SendResult } from "./ports/transport"
