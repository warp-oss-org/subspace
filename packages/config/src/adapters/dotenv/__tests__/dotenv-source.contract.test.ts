import fs from "node:fs/promises"
import path from "node:path"
import { describeConfigSourceContract } from "../../../ports/__tests__/source.contract"
import { DotenvSource } from "../dotenv-source"

describeConfigSourceContract({
  name: "DotenvSource",
  make: async (cwd) => ({
    source: new DotenvSource({ file: ".env", required: true, cwd }),
  }),
  setup: async (cwd) => {
    await fs.writeFile(path.join(cwd, ".env"), "TEST_KEY=test_value\n")
  },
  expectedValue: () => ({ TEST_KEY: "test_value" }),
})
