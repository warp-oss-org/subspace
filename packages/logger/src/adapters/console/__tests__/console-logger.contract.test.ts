import { describeLoggerContract } from "../../../ports/__tests__/logger.contract"
import { consoleHarness } from "./console-harness"

describeLoggerContract(consoleHarness())
