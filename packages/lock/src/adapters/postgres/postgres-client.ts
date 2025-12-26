const { Pool } = require("pg")

export function createPgClientPool(options: { connectionString: string }) {
  return new Pool({
    connectionString: options.connectionString,
  })
}
