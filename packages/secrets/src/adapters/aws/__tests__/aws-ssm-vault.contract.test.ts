import {
  describeListableSecretVaultContract,
  describeReadableSecretVaultContract,
  describeSecretVaultContract,
} from "../../../ports/__tests__/secret-vault.contract"
import { createSsmTestClient } from "../../../tests/utils/create-aws-secrets-client"
import { AwsSsmVault } from "../aws-ssm-vault"

describe("AwsSsmVault", () => {
  let vault: AwsSsmVault

  beforeAll(() => {
    const setup = createSsmTestClient()

    vault = new AwsSsmVault(
      {
        client: setup.client,
      },
      {
        prefix: setup.keyspacePrefix,
      },
    )
  })

  afterAll(async () => {
    await deleteSecrets(vault)
  })

  const deleteSecrets = async (vault: AwsSsmVault) => {
    try {
      const keys = await vault.list()
      for (const key of keys) {
        await vault.delete(key)
      }
    } catch {}
  }

  describeReadableSecretVaultContract("AwsSsmVault", async () => ({
    vault,
    seed: async (key, value) => vault.set(key, value),
    cleanup: async () => {
      await deleteSecrets(vault)
    },
  }))

  describeSecretVaultContract("AwsSsmVault", async () => ({
    vault,
    cleanup: async () => {
      await deleteSecrets(vault)
    },
  }))

  describeListableSecretVaultContract("AwsSsmVault", async () => ({
    vault,
    cleanup: async () => {
      await deleteSecrets(vault)
    },
  }))
})
