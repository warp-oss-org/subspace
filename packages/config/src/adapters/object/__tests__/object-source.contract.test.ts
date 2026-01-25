import { describeConfigSourceContract } from "../../../ports/__tests__/source.contract"
import { ObjectSource } from "../object-source"

describeConfigSourceContract({
  name: "ObjectSource",
  make: async () => ({
    source: new ObjectSource({ TEST_KEY: "test_value" }),
  }),
  setup: async () => {},
  expectedValue: () => ({ TEST_KEY: "test_value" }),
})
