import fs from "node:fs/promises"
import path from "node:path"
import { describeConfigSourceContract } from "../../../ports/__tests__/source.contract"
import { JsonSource } from "../json-source"

describeConfigSourceContract({
  name: "JsonSource",
  make: async (cwd) => ({
    source: new JsonSource({ file: "config.json", required: true, cwd }),
  }),
  setup: async (cwd) => {
    await fs.writeFile(
      path.join(cwd, "config.json"),
      JSON.stringify({ TEST_KEY: "test_value" }),
    )
  },
  expectedValue: () => ({ TEST_KEY: "test_value" }),
})
