import { generateKeyPairSync, randomUUID } from "node:crypto"
import { SecretManagerServiceClient } from "@google-cloud/secret-manager"
import type { Clock } from "@subspace/clock"

interface AccessSecretVersionRequest {
  name: string
}

interface AccessSecretVersionResponse {
  name: string
  payload: { data: Buffer }
}

interface AddSecretVersionRequest {
  parent: string
  payload: { data: Buffer }
}

interface AddSecretVersionResponse {
  name: string
}

interface CreateSecretRequest {
  parent: string
  secretId: string
  secret: {
    replication: { automatic: Record<string, never> }
    labels?: Record<string, string>
  }
}

interface CreateSecretResponse {
  name: string
}

interface DeleteSecretRequest {
  name: string
}

interface GetSecretRequest {
  name: string
}

interface GetSecretResponse {
  name: string
}

interface ListSecretsRequest {
  parent: string
  filter?: string
}

interface ListSecretsResponse {
  name: string
}

interface ListSecretVersionsRequest {
  parent: string
}

interface ListSecretVersionsResponse {
  name: string
  createTime?: string
  state: "ENABLED" | "DISABLED" | "DESTROYED"
}

interface StoredSecretVersion {
  version: string
  value: string
  createdAt: Date
}

interface StoredSecret {
  versions: StoredSecretVersion[]
  currentVersion: string
}

type EmptyResponse = Record<string, never>

export interface FakeSecretManagerServiceDeps {
  clock: Clock
}

export interface FakeSecretManagerServiceClientOptions {
  projectId?: string
}

/**
 * A fake SecretManagerServiceClient that implements the same interface
 * as @google-cloud/secret-manager but uses MemorySecretVault internally.
 *
 * Usage:
 * ```typescript
 * const fakeClient = new FakeSecretManagerServiceClient()
 * const vault = new GcpSecretManagerVault(
 *   { client: fakeClient },
 *   { projectId: 'test-project' }
 * )
 * ```
 */
export class FakeSecretManagerServiceClient {
  private readonly secrets = new Map<string, StoredSecret>()
  private projectId: string
  private readonly clock: Clock

  constructor(
    deps: FakeSecretManagerServiceDeps,
    options: FakeSecretManagerServiceClientOptions = {},
  ) {
    this.projectId = options.projectId ?? "test-project"
    this.clock = deps.clock
  }

  async accessSecretVersion(
    req: AccessSecretVersionRequest,
  ): Promise<[AccessSecretVersionResponse]> {
    const parsed = this.parseVersionName(req.name)
    if (!parsed) {
      throw this.notFoundError(`Invalid secret version name: ${req.name}`)
    }

    const { secret, version } = parsed

    const stored = this.getStored(secret)
    if (!stored) {
      throw this.notFoundError(`Secret not found: ${secret}`)
    }

    let resolvedVersionId = version
    let secretVersion: StoredSecretVersion | undefined

    if (version === "latest") {
      resolvedVersionId = stored.currentVersion
      secretVersion = stored.versions.find((v) => v.version === resolvedVersionId)
      if (!secretVersion) {
        throw this.notFoundError(`Secret version not found: ${req.name}`)
      }
    } else {
      secretVersion = stored.versions.find((v) => v.version === version)
      if (!secretVersion) {
        throw this.notFoundError(`Secret version not found: ${req.name}`)
      }
    }

    return [
      {
        name: req.name.replace("/latest", `/${resolvedVersionId ?? "1"}`),
        payload: { data: Buffer.from(secretVersion.value) },
      },
    ]
  }

  async addSecretVersion(
    req: AddSecretVersionRequest,
  ): Promise<[AddSecretVersionResponse]> {
    const secretId = this.parseSecretName(req.parent)
    if (!secretId) {
      throw this.notFoundError(`Invalid secret name: ${req.parent}`)
    }

    const stored = this.requireStored(secretId, req.parent)

    const versionId = this.nextVersionId(stored)
    const createdAt = this.clock.now()
    const value = req.payload.data.toString()

    stored.versions.push({
      version: versionId,
      value,
      createdAt,
    })
    this.setCurrent(stored, versionId)

    return [
      {
        name: `${req.parent}/versions/${versionId}`,
      },
    ]
  }

  async createSecret(req: CreateSecretRequest): Promise<[CreateSecretResponse]> {
    const secretId = req.secretId

    if (this.secrets.has(secretId)) {
      throw this.alreadyExistsError(`Secret already exists: ${secretId}`)
    }

    this.secrets.set(secretId, { versions: [], currentVersion: "0" })

    return [
      {
        name: `${req.parent}/secrets/${secretId}`,
      },
    ]
  }

  async deleteSecret(req: DeleteSecretRequest): Promise<[EmptyResponse]> {
    const secretId = this.parseSecretName(req.name)
    if (!secretId) {
      throw this.notFoundError(`Invalid secret name: ${req.name}`)
    }

    this.requireStored(secretId, req.name)

    this.secrets.delete(secretId)

    return [{}] as [EmptyResponse]
  }

  async getSecret(req: GetSecretRequest): Promise<[GetSecretResponse]> {
    const secretId = this.parseSecretName(req.name)
    if (!secretId) {
      throw this.notFoundError(`Invalid secret name: ${req.name}`)
    }

    this.requireStored(secretId, req.name)

    return [
      {
        name: req.name,
      },
    ]
  }

  async listSecrets(req: ListSecretsRequest): Promise<[ListSecretsResponse[]]> {
    const results: ListSecretsResponse[] = []

    const filterPrefix = req.filter ? this.extractFilterPrefix(req.filter) : null

    for (const secretId of this.secrets.keys()) {
      if (filterPrefix && !secretId.startsWith(filterPrefix)) {
        continue
      }

      results.push({
        name: this.secretResourceName(secretId),
      })
    }

    return [results]
  }

  async listSecretVersions(
    req: ListSecretVersionsRequest,
  ): Promise<[ListSecretVersionsResponse[]]> {
    const secretId = this.parseSecretName(req.parent)
    if (!secretId) {
      throw this.notFoundError(`Invalid secret name: ${req.parent}`)
    }

    const stored = this.requireStored(secretId, req.parent)

    return [
      stored.versions.map((v) => ({
        name: `${req.parent}/versions/${v.version}`,
        createTime: v.createdAt.toISOString(),
        state:
          v.version === stored.currentVersion
            ? ("ENABLED" as const)
            : ("DISABLED" as const),
      })),
    ]
  }

  /**
   * Extract the secretId prefix from filter strings.
   *
   * The real GCP Secret Manager API supports filters like:
   *   - name:<secretIdPrefix>
   *   - name:projects/<project>/secrets/<secretIdPrefix>
   *
   * Our fake stores secrets keyed by `secretId` (the portion after `/secrets/`).
   */
  private extractFilterPrefix(filter: string): string | null {
    const match = filter.match(/^name:(.+)$/)
    const raw = match?.[1]
    if (!raw) return null

    // If a full resource name prefix is provided, strip it down to the secretId part.
    // Example: projects/p/secrets/foo/bar -> foo/bar
    const secretsMarker = "/secrets/"
    const idx = raw.indexOf(secretsMarker)
    if (idx >= 0) {
      return raw.slice(idx + secretsMarker.length)
    }

    return raw
  }

  private secretResourceName(secretId: string): string {
    return `projects/${this.projectId}/secrets/${secretId}`
  }

  /**
   * Parse version name: projects/{project}/secrets/{secret}/versions/{version}
   */
  private parseVersionName(name: string): { secret: string; version: string } | null {
    const match = name.match(/^projects\/[^/]+\/secrets\/(.+)\/versions\/(.+)$/)
    const secret = match?.[1]
    const version = match?.[2]
    if (!secret || !version) return null
    return { secret, version }
  }

  /**
   * Parse secret name: projects/{project}/secrets/{secret}
   */
  private parseSecretName(name: string): string | null {
    const match = name.match(/^projects\/[^/]+\/secrets\/(.+)$/)
    return match?.[1] ?? null
  }

  private getStored(secretId: string): StoredSecret | null {
    return this.secrets.get(secretId) ?? null
  }

  private requireStored(secretId: string, nameForError: string): StoredSecret {
    const stored = this.getStored(secretId)
    if (!stored) {
      throw this.notFoundError(`Secret not found: ${nameForError}`)
    }
    return stored
  }

  private nextVersionId(stored: StoredSecret): string {
    const last = stored.versions.at(-1)
    if (!last) return "1"
    const n = Number.parseInt(last.version, 10)
    if (!Number.isFinite(n)) return `${stored.versions.length + 1}`
    return `${n + 1}`
  }

  private setCurrent(stored: StoredSecret, version: string): void {
    stored.currentVersion = version
  }

  private notFoundError(message: string): Error & { code: number } {
    const err = new Error(message) as Error & { code: number }
    const NOT_FOUND = 5
    err.code = NOT_FOUND

    return err
  }

  private alreadyExistsError(message: string): Error & { code: number } {
    const err = new Error(message) as Error & { code: number }
    const ALREADY_EXISTS = 6
    err.code = ALREADY_EXISTS

    return err
  }
}

export function createFakeGcpSecretManagerTestClient(
  deps: FakeSecretManagerServiceDeps,
  options: FakeSecretManagerServiceClientOptions = {},
): {
  client: FakeSecretManagerServiceClient
  projectId: string
  keyspacePrefix: string
} {
  const projectId = options.projectId ?? process.env.GCP_PROJECT_ID ?? "test-project"
  const client = new FakeSecretManagerServiceClient(deps, { projectId })
  const keyspacePrefix = `subspace-gcp-secret-manager/${randomUUID()}/`

  return { client, projectId, keyspacePrefix }
}

export function createGcpSecretManagerTestClient(): {
  client: SecretManagerServiceClient
  projectId: string
  keyspacePrefix: string
} {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  })

  const projectId = process.env.GCP_PROJECT_ID ?? "test-project"

  const client = new SecretManagerServiceClient({
    apiEndpoint:
      process.env.GCP_SECRET_MANAGER_ENDPOINT ??
      process.env.GCP_ENDPOINT ??
      "localhost:9090",
    projectId,
    credentials: {
      client_email: "test@test-project.iam.gserviceaccount.com",
      private_key: privateKey,
    },
  })

  const keyspacePrefix = `subspace-gcp-secret-manager/${randomUUID()}/`

  return { client, projectId, keyspacePrefix }
}
