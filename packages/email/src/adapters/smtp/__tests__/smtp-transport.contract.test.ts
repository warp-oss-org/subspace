import { describeEmailTransportContract } from "../../../ports/__tests__/transport.contract"
import { createSmtpTestClient } from "../../../tests/utils/create-smtp-test-client"
import { SmtpTransport } from "../smtp-transport"

describeEmailTransportContract({
  name: "SmtpTransport",
  async make() {
    const client = createSmtpTestClient({ mode: "real-smtp" })

    return { transport: new SmtpTransport({ client }) }
  },
})
