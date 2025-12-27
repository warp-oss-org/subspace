export type EmailAddress = {
  email: string
  name?: string
}

export type EmailRecipient = string | EmailAddress
export type EmailRecipients = EmailRecipient | EmailRecipient[]
