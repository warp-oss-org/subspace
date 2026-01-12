import type { ReadableSecretVault, SecretValue } from "../../ports/secret-vault"

export interface EnvSecretVaultOptions {
  /**
   * Optional prefix to strip from environment variable names.
   * E.g., if prefix is "APP_", then get("DATABASE_URL") reads APP_DATABASE_URL.
   */
  prefix?: string

  /**
   * Custom environment object. Defaults to process.env.
   * Useful for testing.
   */
  env?: Record<string, string | undefined>
}

/**
 * Read-only secret vault backed by environment variables.
 *
 * This adapter is intentionally read-only - environment variables
 * should be set at process startup, not modified at runtime.
 */
export class EnvSecretVault implements ReadableSecretVault {
  private readonly prefix: string
  private readonly env: Record<string, string | undefined>

  constructor(options: EnvSecretVaultOptions = {}) {
    this.prefix = options.prefix ?? ""
    this.env = options.env ?? process.env
  }

  async get(key: string): Promise<SecretValue | null> {
    const envKey = this.resolveKey(key)
    const value = this.env[envKey]

    if (value === undefined) return null

    return { value }
  }

  async exists(key: string): Promise<boolean> {
    const envKey = this.resolveKey(key)

    return this.env[envKey] !== undefined
  }

  private resolveKey(key: string): string {
    return `${this.prefix}${key}`
  }
}
