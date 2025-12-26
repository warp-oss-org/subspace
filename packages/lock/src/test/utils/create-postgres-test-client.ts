import { createPgPool } from "../../adapters/postgres/postgres-pool"

export function createPgTestPool() {
  const connectionString =
    process.env.POSTGRES_URL ??
    "postgres://subspace_lock_user:subspace_lock_password@localhost:15432/subspace_lock_db"

  const pool = createPgPool({ connectionString })

  return { pool }
}
