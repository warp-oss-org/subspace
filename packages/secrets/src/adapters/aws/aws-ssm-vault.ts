import {
  AddTagsToResourceCommand,
  DeleteParameterCommand,
  GetParameterCommand,
  GetParametersByPathCommand,
  ParameterType,
  PutParameterCommand,
  type SSMClient,
} from "@aws-sdk/client-ssm"
import type {
  ListableSecretVault,
  SecretValue,
  SecretVault,
  SetSecretOptions,
} from "../../ports/secret-vault"

export interface AwsSsmVaultOptions {
  /**
   * Optional path prefix for all parameters.
   * E.g., '/myapp/prod/' means get('db-url') resolves to '/myapp/prod/db-url'
   */
  prefix?: string

  /**
   * Parameter type to use when setting secrets.
   * @default 'SecureString'
   */
  parameterType?: "String" | "SecureString"

  /**
   * KMS key ID for SecureString encryption.
   * If not provided, uses the default SSM key.
   */
  kmsKeyId?: string
}

export type AwsSsmVaultDeps = {
  client: SSMClient
}

/**
 * AWS SSM Parameter Store adapter.
 * Stores secrets as SecureString parameters by default.
 */
export class AwsSsmVault implements SecretVault, ListableSecretVault {
  private readonly prefix: string
  private readonly parameterType: ParameterType
  private readonly kmsKeyId?: string

  constructor(
    private readonly deps: AwsSsmVaultDeps,
    options: AwsSsmVaultOptions = {},
  ) {
    this.prefix = this.normalizePrefix(options.prefix ?? "")
    this.parameterType =
      options.parameterType === "String"
        ? ParameterType.STRING
        : ParameterType.SECURE_STRING

    if (options.kmsKeyId) this.kmsKeyId = options.kmsKeyId
  }

  async get(key: string): Promise<SecretValue | null> {
    const name = this.resolveName(key)

    try {
      const response = await this.deps.client.send(
        new GetParameterCommand({
          Name: name,
          WithDecryption: true,
        }),
      )

      if (!response.Parameter?.Value) {
        return null
      }

      return {
        value: response.Parameter.Value,
        ...(response.Parameter.Version !== undefined && {
          version: response.Parameter.Version.toString(),
        }),
        ...(response.Parameter.LastModifiedDate && {
          updatedAt: response.Parameter.LastModifiedDate,
        }),
      }
    } catch (error) {
      if (this.isNotFound(error)) return null
      this.fail("get", name, error)
    }
  }

  async exists(key: string): Promise<boolean> {
    const name = this.resolveName(key)

    try {
      await this.deps.client.send(
        new GetParameterCommand({
          Name: name,
          WithDecryption: false,
        }),
      )
      return true
    } catch (error) {
      if (this.isNotFound(error)) return false
      this.fail("exists", name, error)
    }
  }

  async set(key: string, value: string, options?: SetSecretOptions): Promise<void> {
    if (value.trim().length === 0) {
      throw new Error(`Secret value must not be empty or whitespace: ${key}`)
    }

    const name = this.resolveName(key)
    const tags = options?.metadata
      ? Object.entries(options.metadata).map(([Key, Value]) => ({ Key, Value }))
      : null

    try {
      await this.deps.client.send(
        new PutParameterCommand({
          Name: name,
          Value: value,
          Type: this.parameterType,
          Overwrite: true,
          ...(this.parameterType === ParameterType.SECURE_STRING && this.kmsKeyId
            ? { KeyId: this.kmsKeyId }
            : {}),
        }),
      )

      if (tags) {
        await this.deps.client.send(
          new AddTagsToResourceCommand({
            ResourceType: "Parameter",
            ResourceId: name,
            Tags: tags,
          }),
        )
      }
    } catch (error) {
      this.fail("set", name, error)
    }
  }

  async delete(key: string): Promise<void> {
    const name = this.resolveName(key)

    try {
      await this.deps.client.send(
        new DeleteParameterCommand({
          Name: name,
        }),
      )
    } catch (error) {
      if (!this.isNotFound(error)) this.fail("delete", name, error)
    }
  }

  async list(prefix?: string): Promise<string[]> {
    const path = this.resolvePath(prefix)
    const keys: string[] = []

    try {
      let nextToken: string | undefined

      do {
        const response = await this.deps.client.send(
          new GetParametersByPathCommand({
            Path: path,
            Recursive: true,
            WithDecryption: false,
            NextToken: nextToken,
          }),
        )

        for (const param of response.Parameters ?? []) {
          if (param.Name) {
            const key = this.prefix ? param.Name.slice(this.prefix.length) : param.Name
            keys.push(key)
          }
        }

        nextToken = response.NextToken
      } while (nextToken)

      return keys.sort()
    } catch (error) {
      this.fail("list", path, error)
    }
  }

  private resolveName(key: string): string {
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

  private resolvePath(prefix?: string): string {
    const p = this.normalizeKey(prefix ?? "")
    const path = `${this.prefix}${p}`

    if (!path) return "/"

    return path.endsWith("/") ? path : `${path}/`
  }

  private isNotFound(error: unknown): boolean {
    return (error as { name?: string }).name === "ParameterNotFound"
  }

  private fail(op: string, name: string, cause: unknown): never {
    throw new Error(`Failed to ${op} parameter: ${name}`, { cause })
  }
}
