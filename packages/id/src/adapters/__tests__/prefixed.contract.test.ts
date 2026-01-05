import { describeIdGeneratorContract } from "../../ports/__tests__/id-generator.contract"
import { prefixed } from "../prefixed"
import { uuidV7 } from "../uuid"

describeIdGeneratorContract("prefixed (usr_)", () => prefixed("usr", uuidV7))
