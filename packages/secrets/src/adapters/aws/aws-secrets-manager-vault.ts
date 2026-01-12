import {
  CreateSecretCommand,
  DeleteSecretCommand,
  DescribeSecretCommand,
  GetSecretValueCommand,
  ListSecretsCommand,
  type ListSecretsCommandInput,
  ListSecretVersionIdsCommand,
  type SecretsManagerClient,
  UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager"
import type {
  ListableSecretVault,
  SecretValue,
  SecretVault,
  SecretVersion,
  SetSecretOptions,
  VersionedSecretVault,
} from "../../ports/secret-vault"

export interface AwsSecretsManagerVaultOptions {
  prefix?: string
  kmsKeyId?: string
  forceDeleteWithoutRecovery?: boolean
}

export type AwsSecretsManagerVaultDeps = {
  client: SecretsManagerClient
}

export class AwsSecretsManagerVault
  implements SecretVault, ListableSecretVault, VersionedSecretVault
{
  private readonly prefix: string
  private readonly kmsKeyId?: string
  private readonly forceDeleteWithoutRecovery: boolean

  constructor(
    private readonly deps: AwsSecretsManagerVaultDeps,
    options: AwsSecretsManagerVaultOptions = {},
  ) {
    this.prefix = this.normalizePrefix(options.prefix ?? "")
    this.forceDeleteWithoutRecovery = options.forceDeleteWithoutRecovery ?? false

    if (options.kmsKeyId) this.kmsKeyId = options.kmsKeyId
  }

  async get(key: string): Promise<SecretValue | null> {
    const secretId = this.resolveId(key)

    try {
      const response = await this.deps.client.send(
        new GetSecretValueCommand({
          SecretId: secretId,
        }),
      )

      const value = response.SecretString ?? ""

      return {
        value,
        ...(response.VersionId && { version: response.VersionId }),
        ...(response.CreatedDate && { updatedAt: response.CreatedDate }),
      }
    } catch (error: unknown) {
      if (this.isNotFound(error)) {
        return null
      }

      this.fail("get", secretId, error)
    }
  }

  async exists(key: string): Promise<boolean> {
    const secretId = this.resolveId(key)

    try {
      await this.deps.client.send(
        new DescribeSecretCommand({
          SecretId: secretId,
        }),
      )
      return true
    } catch (error: unknown) {
      if (this.isNotFound(error)) {
        return false
      }
      this.fail("check", secretId, error)
    }
  }

  async set(key: string, value: string, options?: SetSecretOptions): Promise<void> {
    if (value.trim().length === 0) {
      throw new Error(`Secret value must not be empty or whitespace: ${key}`)
    }

    const secretId = this.resolveId(key)
    const tags = options?.metadata
      ? Object.entries(options.metadata).map(([Key, Value]) => ({ Key, Value }))
      : null

    try {
      await this.deps.client.send(
        new UpdateSecretCommand({
          SecretId: secretId,
          SecretString: value,
          ...(this.kmsKeyId ? { KmsKeyId: this.kmsKeyId } : {}),
          ...(tags ? { Tags: tags } : {}),
        }),
      )
    } catch (error: unknown) {
      if (this.isNotFound(error)) {
        try {
          await this.deps.client.send(
            new CreateSecretCommand({
              Name: secretId,
              SecretString: value,
              ...(this.kmsKeyId ? { KmsKeyId: this.kmsKeyId } : {}),
              ...(tags ? { Tags: tags } : {}),
            }),
          )
        } catch (createError: unknown) {
          if (!this.isAlreadyExists(createError)) {
            this.fail("set", secretId, createError)
          }
          await this.deps.client.send(
            new UpdateSecretCommand({
              SecretId: secretId,
              SecretString: value,
              ...(this.kmsKeyId ? { KmsKeyId: this.kmsKeyId } : {}),
              ...(tags ? { Tags: tags } : {}),
            }),
          )
        }
      } else {
        this.fail("set", secretId, error)
      }
    }
  }

  async delete(key: string): Promise<void> {
    const secretId = this.resolveId(key)

    try {
      await this.deps.client.send(
        new DeleteSecretCommand({
          SecretId: secretId,
          ForceDeleteWithoutRecovery: this.forceDeleteWithoutRecovery,
        }),
      )
    } catch (error: unknown) {
      if (!this.isNotFound(error)) {
        this.fail("delete", secretId, error)
      }
    }
  }

  async list(prefix?: string): Promise<string[]> {
    const fullPrefix = this.resolveListPrefix(prefix)
    const keys: string[] = []

    try {
      let nextToken: string | undefined

      do {
        const input = {
          ...(nextToken ? { NextToken: nextToken } : {}),
          ...(fullPrefix ? { Filters: [{ Key: "name", Values: [fullPrefix] }] } : {}),
        } satisfies ListSecretsCommandInput

        const response = await this.deps.client.send(new ListSecretsCommand(input))

        for (const secret of response.SecretList ?? []) {
          if (secret.Name?.startsWith(fullPrefix)) {
            const key = this.prefix ? secret.Name.slice(this.prefix.length) : secret.Name
            keys.push(key)
          }
        }

        nextToken = response.NextToken
      } while (nextToken)

      return keys.sort()
    } catch (error: unknown) {
      this.fail("list", fullPrefix, error)
    }
  }

  async getVersion(key: string, version: string): Promise<SecretValue | null> {
    const secretId = this.resolveId(key)

    try {
      const response = await this.deps.client.send(
        new GetSecretValueCommand({
          SecretId: secretId,
          VersionId: version,
        }),
      )

      const value = response.SecretString ?? ""

      return {
        value,
        ...(response.VersionId && { version: response.VersionId }),
        ...(response.CreatedDate && { updatedAt: response.CreatedDate }),
      }
    } catch (error: unknown) {
      if (this.isNotFound(error)) return null

      this.fail("get version", `${secretId}@${version}`, error)
    }
  }

  async listVersions(key: string): Promise<SecretVersion[]> {
    const secretId = this.resolveId(key)

    try {
      const response = await this.deps.client.send(
        new ListSecretVersionIdsCommand({
          SecretId: secretId,
          IncludeDeprecated: true,
        }),
      )

      const versions: SecretVersion[] = []

      for (const v of response.Versions ?? []) {
        if (v.VersionId) {
          versions.push({
            version: v.VersionId,
            ...(v.CreatedDate && { createdAt: v.CreatedDate }),
            current: v.VersionStages?.includes("AWSCURRENT") ?? false,
          })
        }
      }

      return versions.sort((a, b) => {
        const at = a.createdAt?.getTime() ?? 0
        const bt = b.createdAt?.getTime() ?? 0
        return bt - at
      })
    } catch (error: unknown) {
      if (this.isNotFound(error)) return []

      this.fail("list versions", secretId, error)
    }
  }

  private resolveId(key: string): string {
    return `${this.prefix}${this.normalizeKey(key)}`
  }

  private normalizePrefix(prefix: string): string {
    if (!prefix) return ""
    const withLeading = prefix.startsWith("/") ? prefix : `/${prefix}`

    return withLeading.endsWith("/") ? withLeading : `${withLeading}/`
  }

  private normalizeKey(key: string): string {
    return key.startsWith("/") ? key.slice(1) : key
  }

  private resolveListPrefix(prefix?: string): string {
    const p = this.normalizeKey(prefix ?? "")

    return `${this.prefix}${p}`
  }

  private isNotFound(error: unknown): boolean {
    return (error as { name?: string })?.name === "ResourceNotFoundException"
  }

  private isAlreadyExists(error: unknown): boolean {
    return (error as { name?: string })?.name === "ResourceExistsException"
  }

  private fail(op: string, id: string, cause: unknown): never {
    throw new Error(`Failed to ${op} secret: ${id}`, { cause })
  }
}
