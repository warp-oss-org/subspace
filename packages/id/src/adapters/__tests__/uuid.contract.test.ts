import { describeIdGeneratorContract } from "../../ports/__tests__/id-generator.contract"
import { uuidV4, uuidV7 } from "../uuid"

describeIdGeneratorContract("uuidV4", () => uuidV4)
describeIdGeneratorContract("uuidV7", () => uuidV7)
