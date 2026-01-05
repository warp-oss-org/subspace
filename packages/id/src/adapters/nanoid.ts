import { nanoid as nano } from "nanoid"
import type { IdGenerator } from "../ports/id-generator"

export const nanoid = (size?: number): IdGenerator<string> => ({
  generate: () => nano(size),
})
