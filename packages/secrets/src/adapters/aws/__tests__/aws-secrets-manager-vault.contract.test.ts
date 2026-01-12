import {
  describeListableSecretVaultContract,
  describeReadableSecretVaultContract,
  describeSecretVaultContract,
  describeVersionedSecretVaultContract,
} from "../../../ports/__tests__/secret-vault.contract"
import { createSecretsManagerTestClient } from "../../../tests/utils/create-aws-secrets-client"
import { AwsSecretsManagerVault } from "../aws-secrets-manager-vault"

describe("AwsSecretsManagerVault", () => {
  let vault: AwsSecretsManagerVault

  beforeAll(() => {
    const setup = createSecretsManagerTestClient()

    vault = new AwsSecretsManagerVault(
      {
        client: setup.client,
      },
      {
        prefix: setup.keyspacePrefix,
        forceDeleteWithoutRecovery: true,
      },
    )
  })

  afterAll(async () => {
    await deleteSecrets(vault)
  })

  const deleteSecrets = async (vault: AwsSecretsManagerVault) => {
    try {
      const keys = await vault.list()
      for (const key of keys) {
        await vault.delete(key)
      }
    } catch {}
  }

  describeReadableSecretVaultContract("AwsSecretsManagerVault", async () => ({
    vault,
    seed: async (key, value) => vault.set(key, value),
    cleanup: async () => {
      await deleteSecrets(vault)
    },
  }))

  describeSecretVaultContract("AwsSecretsManagerVault", async () => ({
    vault,
    cleanup: async () => {
      await deleteSecrets(vault)
    },
  }))

  describeListableSecretVaultContract("AwsSecretsManagerVault", async () => ({
    vault,
    cleanup: async () => {
      await deleteSecrets(vault)
    },
  }))

  describeVersionedSecretVaultContract("AwsSecretsManagerVault", async () => ({
    vault,
    cleanup: async () => {
      await deleteSecrets(vault)
    },
  }))
})
