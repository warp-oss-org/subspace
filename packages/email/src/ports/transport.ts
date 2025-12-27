import type { EmailMessage } from "./message"

export type SendResult = {
  provider: string
  messageId: string

  accepted?: string[]
  rejected?: string[]
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<SendResult>
}
