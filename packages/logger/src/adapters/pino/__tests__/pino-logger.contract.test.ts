import { describeLoggerContract } from "../../../ports/__tests__/logger.contract"
import { pinoHarness } from "./pino-harness"

describeLoggerContract(pinoHarness())
