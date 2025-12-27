import { describeEmailTransportContract } from "../../../ports/__tests__/transport.contract"
import { PostmarkTransport } from "../postmark-transport"

function createPostmarkTestClient() {
  return {
    async sendEmail() {
      return {
        MessageID: "postmark-test-message-id",
      }
    },
  }
}

describeEmailTransportContract({
  name: "PostmarkTransport",
  async make() {
    const client = createPostmarkTestClient() as any

    return { transport: new PostmarkTransport({ client }) }
  },
  capabilities: () => ({
    recordsAcceptedRejected: false,
  }),
})
