import {
  DescribeSecretCommand,
  GetSecretValueCommand,
  type SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager"
import { createSecretsManagerTestClient } from "../../../tests/utils/create-aws-secrets-client"
import { deleteAllSecrets } from "../../../tests/utils/delete-all-secrets"
import { AwsSecretsManagerVault } from "../aws-secrets-manager-vault"

describe("AwsSecretsManagerVault (integration)", () => {
  let client: SecretsManagerClient
  let keyspacePrefix: string

  beforeAll(() => {
    const testClient = createSecretsManagerTestClient()
    client = testClient.client
    keyspacePrefix = testClient.keyspacePrefix
  })

  const normalizePrefix = (prefix: string): string => {
    const p = prefix.replace(/^\/+/, "").replace(/\/+$/, "")
    return `/${p}/`
  }

  const normalizeKey = (key: string): string => {
    return key.replace(/^\/+/, "")
  }

  const resolveId = (prefix: string, key: string): string => {
    return `${normalizePrefix(prefix)}${normalizeKey(key)}`
  }

  const cleanup = async () => {
    await deleteAllSecrets(
      new AwsSecretsManagerVault({ client }, { prefix: keyspacePrefix }),
    )
  }

  afterEach(async () => {
    await cleanup()
  })

  afterAll(async () => {
    await cleanup()
  })

  describe("prefix wiring", () => {
    it("persists secrets under prefixed names", async () => {
      const vault = new AwsSecretsManagerVault({ client }, { prefix: keyspacePrefix })

      const key = "alpha"
      await vault.set(key, "value")

      const secretId = resolveId(keyspacePrefix, key)

      const described = await client.send(
        new DescribeSecretCommand({
          SecretId: secretId,
        }),
      )

      expect(described.Name).toBe(secretId)

      await expect(
        client.send(
          new DescribeSecretCommand({
            SecretId: key,
          }),
        ),
      ).rejects.toBeDefined()
    })

    it("two vaults with different prefixes do not interfere", async () => {
      const vaultA = new AwsSecretsManagerVault(
        { client },
        { prefix: `${keyspacePrefix}A/` },
      )
      const vaultB = new AwsSecretsManagerVault(
        { client },
        { prefix: `${keyspacePrefix}B/` },
      )

      await vaultA.set("shared", "A")
      await vaultB.set("shared", "B")

      expect((await vaultA.get("shared"))!.value).toBe("A")
      expect((await vaultB.get("shared"))!.value).toBe("B")
    })
  })

  describe("provider metadata wiring", () => {
    it("updatedAt reflects Secrets Manager version CreatedDate (sanity)", async () => {
      const vault = new AwsSecretsManagerVault({ client }, { prefix: keyspacePrefix })

      const key = "timestamped"
      await vault.set(key, "value")

      const fromVault = await vault.get(key)
      expect(fromVault).not.toBeNull()
      expect(fromVault!.updatedAt).toBeInstanceOf(Date)

      const secretId = resolveId(keyspacePrefix, key)
      const raw = await client.send(
        new GetSecretValueCommand({
          SecretId: secretId,
        }),
      )

      expect(raw.CreatedDate).toBeInstanceOf(Date)

      expect(
        Math.abs(raw.CreatedDate!.getTime() - fromVault!.updatedAt!.getTime()),
      ).toBeLessThan(60_000)
    })
  })
})
