import { describeEmailTransportContract } from "../../../ports/__tests__/transport.contract"
import { SendGridTransport } from "../sendgrid-transport"

function createSendGridTestClient() {
  return {
    async send() {
      return [
        {
          statusCode: 202,
          body: "",
          headers: {
            "x-message-id": "sendgrid-test-message-id",
          },
        },
        undefined,
      ] as const
    },
  }
}

describeEmailTransportContract({
  name: "SendGridTransport",
  async make() {
    const client = createSendGridTestClient() as any

    return { transport: new SendGridTransport({ client }) }
  },
  capabilities: () => ({
    recordsAcceptedRejected: false,
  }),
})
