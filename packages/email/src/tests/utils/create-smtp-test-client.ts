import { createTransport, type Transporter } from "nodemailer"

type SmtpTestClientOptions = {
  mode: "in-memory" | "real-smtp"
}

export function createSmtpTestClient(opts?: SmtpTestClientOptions): Transporter {
  if (opts?.mode === "in-memory") {
    return createTransport({
      streamTransport: true,
      newline: "unix",
      buffer: true,
    })
  }

  return createTransport({
    host: "localhost",
    port: 1026,
    secure: false,
    auth: {
      user: "test",
      pass: "test",
    },
  })
}
