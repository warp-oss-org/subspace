export interface SecretValue {
  value: string
  metadata?: Record<string, string>
  version?: string
  updatedAt?: Date
  expiresAt?: Date
}

export interface SetSecretOptions {
  metadata?: Record<string, string>
  expiresAt?: Date
}

export interface SecretVersion {
  version: string
  createdAt?: Date
  current: boolean
}

export type SecretKey = string

/**
 * Minimal read-only secret access.
 */
export interface ReadableSecretVault {
  get(key: SecretKey): Promise<SecretValue | null>
  exists(key: SecretKey): Promise<boolean>
}

/**
 * Full read-write secret vault.
 */
export interface SecretVault extends ReadableSecretVault {
  set(key: SecretKey, value: string, options?: SetSecretOptions): Promise<void>
  delete(key: SecretKey): Promise<void>
}

/**
 * Vault supports listing secrets by prefix.
 */
export interface ListableSecretVault {
  list(prefix?: string): Promise<SecretKey[]>
}

/**
 * Vault supports secret versioning.
 */
export interface VersionedSecretVault {
  getVersion(key: SecretKey, version: string): Promise<SecretValue | null>
  listVersions(key: SecretKey): Promise<SecretVersion[]>
}
