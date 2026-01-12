import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { Clock } from "@subspace/clock"
import type {
  ListableSecretVault,
  SecretValue,
  SecretVault,
  SetSecretOptions,
} from "../../ports/secret-vault"

export type JsonFileSecretVaultDeps = {
  clock: Clock
}

export interface JsonFileSecretVaultOptions {
  /**
   * Path to the secrets file.
   */
  path: string

  /**
   * Create the file if it doesn't exist.
   * @default true
   */
  createIfMissing?: boolean
}

interface JsonSecretEntry {
  value: string
  metadata?: Record<string, string>
  expiresAt?: string
}

type JsonSecretsFile = Record<string, JsonSecretEntry>

/**
 * JSON file–backed secret vault for development and CI.
 *
 * Stores secrets in a JSON file and supports metadata + expiry.
 *
 * Note: This is intentionally JSON-only. `.env` is a manual configuration
 * format and is not treated as a programmatic secret store.
 */
export class JsonFileSecretVault implements SecretVault, ListableSecretVault {
  private readonly path: string
  private readonly createIfMissing: boolean

  constructor(
    private readonly deps: JsonFileSecretVaultDeps,
    options: JsonFileSecretVaultOptions,
  ) {
    this.path = options.path
    this.createIfMissing = options.createIfMissing ?? true
  }

  async get(key: string): Promise<SecretValue | null> {
    const secrets = await this.load()
    const entry = secrets[key]

    if (!entry) return null

    const now = this.deps.clock.now()

    if (this.isExpired(entry, now)) {
      delete secrets[key]
      await this.save(secrets)

      return null
    }

    const expiresAt = this.parseExpiresAt(entry)

    return {
      value: entry.value,
      ...(entry.metadata && { metadata: entry.metadata }),
      ...(expiresAt && { expiresAt }),
    }
  }

  async exists(key: string): Promise<boolean> {
    const secret = await this.get(key)

    return secret !== null
  }

  async set(key: string, value: string, options?: SetSecretOptions): Promise<void> {
    if (value.trim().length === 0) {
      throw new Error(`Secret value must not be empty or whitespace: ${key}`)
    }

    const secrets = await this.load()
    const entry: JsonSecretEntry = {
      value,
      ...(options?.metadata && { metadata: options.metadata }),
      ...(options?.expiresAt && { expiresAt: options.expiresAt.toISOString() }),
    }

    secrets[key] = entry

    await this.save(secrets)
  }

  async delete(key: string): Promise<void> {
    const secrets = await this.load()
    delete secrets[key]

    await this.save(secrets)
  }

  async list(prefix?: string): Promise<string[]> {
    const secrets = await this.load()
    const now = this.deps.clock.now()

    const keys = Object.entries(secrets)
      .filter(([key, entry]) => {
        if (this.isExpired(entry, now)) return false
        if (prefix && !key.startsWith(prefix)) return false
        return true
      })
      .map(([key]) => key)
      .sort()

    return keys
  }

  private async load(): Promise<JsonSecretsFile> {
    const exists = await this.fileExists()

    if (!exists) {
      if (this.createIfMissing) {
        return {}
      }
      throw new Error(`Secrets file not found: ${this.path}`)
    }

    const content = await readFile(this.path, "utf-8")
    return JSON.parse(content) as JsonSecretsFile
  }

  private async save(secrets: JsonSecretsFile): Promise<void> {
    const dir = dirname(this.path)
    await mkdir(dir, { recursive: true })

    const content = `${JSON.stringify(secrets, null, 2)}\n`

    await writeFile(this.path, content, "utf-8")
  }

  private async fileExists(): Promise<boolean> {
    try {
      await access(this.path)
      return true
    } catch {
      return false
    }
  }

  private parseExpiresAt(entry: { expiresAt?: string }): Date | null {
    if (!entry.expiresAt) return null

    return new Date(entry.expiresAt)
  }

  private isExpired(entry: { expiresAt?: string }, now: Date): boolean {
    const expiresAt = this.parseExpiresAt(entry)
    return expiresAt !== null && expiresAt < now
  }
}
