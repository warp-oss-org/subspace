import type { Clock } from "@subspace/clock"
import type {
  ListableSecretVault,
  SecretKey,
  SecretValue,
  SecretVault,
  SecretVersion,
  SetSecretOptions,
  VersionedSecretVault,
} from "../../ports/secret-vault"

interface StoredSecret {
  value: string
  metadata?: Record<string, string>
  expiresAt?: Date
  versions: Array<{
    version: string
    value: string
    metadata?: Record<string, string>
    createdAt: Date
  }>
}

export type MemorySecretVaultDeps = {
  clock: Clock
}

/**
 * In-memory secret vault for testing and local development.
 * Supports listing and versioning.
 */
export class MemorySecretVault
  implements SecretVault, ListableSecretVault, VersionedSecretVault
{
  private secrets = new Map<string, StoredSecret>()
  private versionCounter = 0

  constructor(private readonly deps: MemorySecretVaultDeps) {}

  async get(key: string): Promise<SecretValue | null> {
    const stored = this.secrets.get(key)
    if (!stored) return null

    if (stored.expiresAt && stored.expiresAt < new Date()) {
      this.secrets.delete(key)
      return null
    }

    const currentVersion = stored.versions[stored.versions.length - 1]

    return {
      value: stored.value,
      ...(stored.metadata && { metadata: stored.metadata }),
      ...(currentVersion?.version && { version: currentVersion.version }),
      ...(currentVersion?.createdAt && { updatedAt: currentVersion.createdAt }),
      ...(stored.expiresAt && { expiresAt: stored.expiresAt }),
    }
  }

  async exists(key: string): Promise<boolean> {
    const secret = await this.get(key)

    return secret !== null
  }

  async set(key: string, value: string, options?: SetSecretOptions): Promise<void> {
    this.setSync(key, value, options)
  }

  async delete(key: string): Promise<void> {
    this.secrets.delete(key)
  }

  async list(prefix?: string): Promise<SecretKey[]> {
    const keys: string[] = []

    for (const [key, stored] of this.secrets.entries()) {
      if (stored.expiresAt && stored.expiresAt < this.deps.clock.now()) {
        this.secrets.delete(key)
        continue
      }

      if (!prefix || key.startsWith(prefix)) {
        keys.push(key)
      }
    }

    return keys.sort()
  }

  async getVersion(key: string, version: string): Promise<SecretValue | null> {
    const stored = this.secrets.get(key)

    if (!stored) return null

    const versionData = stored.versions.find((v) => v.version === version)

    if (!versionData) return null

    return {
      value: versionData.value,
      ...(versionData.metadata && { metadata: versionData.metadata }),
      version: versionData.version,
      updatedAt: versionData.createdAt,
    }
  }

  async listVersions(key: string): Promise<SecretVersion[]> {
    const stored = this.secrets.get(key)
    if (!stored) return []

    const currentVersion = stored.versions[stored.versions.length - 1]?.version

    return stored.versions.map((v) => ({
      version: v.version,
      createdAt: v.createdAt,
      current: v.version === currentVersion,
    }))
  }

  private setSync(key: string, value: string, options?: SetSecretOptions): void {
    const version = `v${++this.versionCounter}`
    const now = this.deps.clock.now()
    const existing = this.secrets.get(key)
    const versions = existing?.versions ?? []

    versions.push({
      version,
      value,
      createdAt: now,
      ...(options?.metadata && { metadata: options.metadata }),
    })

    this.secrets.set(key, {
      value,
      versions,
      ...(options?.metadata && { metadata: options.metadata }),
      ...(options?.expiresAt && { expiresAt: options.expiresAt }),
    })
  }
}
