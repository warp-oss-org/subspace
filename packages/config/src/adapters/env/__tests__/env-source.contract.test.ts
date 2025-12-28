import { describeConfigSourceContract } from "../../../ports/__tests__/source.contract"
import { EnvSource } from "../env-source"

describeConfigSourceContract({
  name: "EnvSource",
  make: async () => ({
    source: new EnvSource({ env: { TEST_KEY: "test_value" } }),
  }),
  setup: async () => {},
  expectedValue: () => ({ TEST_KEY: "test_value" }),
})
