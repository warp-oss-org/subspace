import { randomUUID as v4 } from "node:crypto"
import { v7 } from "uuid"
import type { IdGenerator } from "../ports/id-generator"

export const uuidV4: IdGenerator<string> = { generate: () => v4() }
export const uuidV7: IdGenerator<string> = { generate: () => v7() }
