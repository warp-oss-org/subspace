import { Pool } from "pg"

export function createPgPool(options: { connectionString: string }) {
  return new Pool({
    connectionString: options.connectionString,
  })
}
