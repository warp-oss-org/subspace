import { describeEmailTransportContract } from "../../../ports/__tests__/transport.contract"
import { createSesTestClient } from "../../../tests/utils/create-ses-test-client"
import { SesTransport } from "../ses-transport"

describeEmailTransportContract({
  name: "SesTransport",
  async make() {
    const client = createSesTestClient()

    return {
      transport: new SesTransport({ client }),
    }
  },
  capabilities: () => ({
    supportsAttachments: true,
    supportsInlineAttachments: true,
    supportsHeaders: true,
    supportsTags: true,
    supportsMetadata: true,
    supportsReplyTo: true,
    supportsCc: true,
    supportsBcc: true,
  }),
})
