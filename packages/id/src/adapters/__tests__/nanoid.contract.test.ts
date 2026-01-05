import { describeIdGeneratorContract } from "../../ports/__tests__/id-generator.contract"
import { nanoid } from "../nanoid"

describeIdGeneratorContract("nanoid (default)", () => nanoid())
describeIdGeneratorContract("nanoid (size: 10)", () => nanoid(10))
