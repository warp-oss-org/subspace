import type { SecretManagerServiceClient } from "@google-cloud/secret-manager"
import type {
  ListableSecretVault,
  SecretValue,
  SecretVault,
  SecretVersion,
  SetSecretOptions,
  VersionedSecretVault,
} from "../../ports/secret-vault"

export interface GcpSecretManagerVaultOptions {
  projectId: string
  prefix?: string
}

export type GcpSecretManagerDeps = {
  client: SecretManagerServiceClient
}

export class GcpSecretManagerVault
  implements SecretVault, ListableSecretVault, VersionedSecretVault
{
  private readonly projectId: string
  private readonly prefix: string

  constructor(
    private readonly deps: GcpSecretManagerDeps,
    options: GcpSecretManagerVaultOptions,
  ) {
    this.projectId = options.projectId
    this.prefix = options.prefix ?? ""
  }

  async get(key: string): Promise<SecretValue | null> {
    const name = this.resolveVersionName(key, "latest")

    try {
      const [response] = await this.deps.client.accessSecretVersion({ name })

      const value = response.payload?.data?.toString() ?? ""

      const version = response.name ? this.extractVersionId(response.name) : null

      return {
        value,
        ...(version && { version }),
      }
    } catch (error) {
      if (this.isNotFound(error)) {
        return null
      }
      throw new Error(`Failed to get secret: ${key}`, { cause: error })
    }
  }

  async exists(key: string): Promise<boolean> {
    const name = this.resolveSecretName(key)

    try {
      await this.deps.client.getSecret({ name })
      return true
    } catch (error) {
      if (this.isNotFound(error)) {
        return false
      }
      throw new Error(`Failed to check secret: ${key}`, { cause: error })
    }
  }

  async set(key: string, value: string, options?: SetSecretOptions): Promise<void> {
    if (value.trim().length === 0) {
      throw new Error(`Secret value must not be empty or whitespace: ${key}`)
    }

    const secretName = this.resolveSecretName(key)
    const parent = this.projectParent()
    const secretId = `${this.prefix}${key}`

    const labels = this.toLabels(options?.metadata)

    try {
      await this.deps.client.addSecretVersion({
        parent: secretName,
        payload: { data: Buffer.from(value) },
      })
    } catch (error) {
      if (this.isNotFound(error)) {
        try {
          await this.deps.client.createSecret({
            parent,
            secretId,
            secret: {
              replication: { automatic: {} },
              ...(labels ? { labels } : {}),
            },
          })
        } catch (createError) {
          if (!this.isAlreadyExists(createError)) {
            throw new Error(`Failed to set secret: ${key}`, { cause: createError })
          }
        }
        await this.deps.client.addSecretVersion({
          parent: secretName,
          payload: { data: Buffer.from(value) },
        })
      } else {
        throw new Error(`Failed to set secret: ${key}`, { cause: error })
      }
    }
  }

  async delete(key: string): Promise<void> {
    const name = this.resolveSecretName(key)

    try {
      await this.deps.client.deleteSecret({ name })
    } catch (error) {
      if (!this.isNotFound(error)) {
        throw new Error(`Failed to delete secret: ${key}`, { cause: error })
      }
    }
  }

  async list(prefix?: string): Promise<string[]> {
    const parent = this.projectParent()
    const fullPrefix = this.prefix + (prefix ?? "")
    const keys: string[] = []

    try {
      const [secrets] = await this.deps.client.listSecrets({
        parent,
        ...(fullPrefix ? { filter: `name:${fullPrefix}` } : {}),
      })

      for (const secret of secrets) {
        if (secret.name) {
          const secretId = this.extractSecretId(secret.name)
          if (!secretId) continue

          if (!this.prefix || secretId.startsWith(this.prefix)) {
            const key = this.prefix ? secretId.slice(this.prefix.length) : secretId
            keys.push(key)
          }
        }
      }

      return keys.sort()
    } catch (error) {
      throw new Error(`Failed to list secrets: ${fullPrefix}`, { cause: error })
    }
  }

  async getVersion(key: string, version: string): Promise<SecretValue | null> {
    const name = this.resolveVersionName(key, version)

    try {
      const [response] = await this.deps.client.accessSecretVersion({ name })

      const value = response.payload?.data?.toString() ?? ""

      return {
        value,
        version,
      }
    } catch (error) {
      if (this.isNotFound(error)) return null

      throw new Error(`Failed to get secret version: ${key}@${version}`, { cause: error })
    }
  }

  async listVersions(key: string): Promise<SecretVersion[]> {
    const parent = this.resolveSecretName(key)

    try {
      const [versions] = await this.deps.client.listSecretVersions({ parent })

      const parsedVersions: { version: string; createdAt?: Date; enabled: boolean }[] = []

      for (const v of versions) {
        if (v.name) {
          const versionId = this.extractVersionId(v.name)
          if (!versionId) continue

          parsedVersions.push({
            version: versionId,
            ...(v.createTime && { createdAt: new Date(v.createTime as string) }),
            enabled: v.state === "ENABLED",
          })
        }
      }

      const enabledVersions = parsedVersions.filter((v) => v.enabled)
      const highestEnabledVersionNumber = enabledVersions.reduce<number>((max, v) => {
        const num = parseInt(v.version, 10)
        return num > max ? num : max
      }, -1)

      const result: SecretVersion[] = parsedVersions
        .sort((a, b) => parseInt(b.version, 10) - parseInt(a.version, 10))
        .map((v) => ({
          version: v.version,
          ...(v.createdAt && { createdAt: v.createdAt }),
          current: v.enabled && parseInt(v.version, 10) === highestEnabledVersionNumber,
        }))

      return result
    } catch (error) {
      if (this.isNotFound(error)) return []

      throw new Error(`Failed to list secret versions: ${key}`, { cause: error })
    }
  }

  private extractSecretId(name: string): string | null {
    const match = name.match(/\/secrets\/(.+)$/)

    return match?.[1] ?? null
  }

  private extractVersionId(name: string): string | null {
    const match = name.match(/\/versions\/(\d+)$/)
    return match?.[1] ?? null
  }

  private isNotFound(error: unknown): boolean {
    return (error as { code?: number })?.code === 5
  }

  private isAlreadyExists(error: unknown): boolean {
    return (error as { code?: number })?.code === 6
  }

  private resolveSecretName(key: string): string {
    return `projects/${this.projectId}/secrets/${this.prefix}${key}`
  }

  private resolveVersionName(key: string, version: string): string {
    return `${this.resolveSecretName(key)}/versions/${version}`
  }

  private projectParent(): string {
    return `projects/${this.projectId}`
  }

  private toLabels(
    metadata?: Record<string, string>,
  ): Record<string, string> | undefined {
    if (!metadata) return undefined

    const labels: Record<string, string> = {}

    for (const [rawKey, rawValue] of Object.entries(metadata)) {
      const key = this.normalizeLabelKey(rawKey)
      const value = this.normalizeLabelValue(rawValue)
      if (!key || value === null) continue

      labels[key] = value
    }

    return Object.keys(labels).length > 0 ? labels : undefined
  }

  private normalizeLabelKey(input: string): string | null {
    const trimmed = input.trim().toLowerCase()
    const sanitized = trimmed.replace(/[^a-z0-9_-]/g, "_")

    if (!sanitized) return null

    const withPrefix = /^[a-z]/.test(sanitized) ? sanitized : `k_${sanitized}`
    const sliced = withPrefix.slice(0, 63)

    if (!/^[a-z][a-z0-9_-]{0,62}$/.test(sliced)) return null

    return sliced
  }

  private normalizeLabelValue(input: string): string | null {
    const trimmed = input.trim().toLowerCase()
    const sanitized = trimmed.replace(/[^a-z0-9_-]/g, "_")
    const sliced = sanitized.slice(0, 63)

    if (!/^[a-z0-9_-]{0,63}$/.test(sliced)) return null

    return sliced
  }
}
