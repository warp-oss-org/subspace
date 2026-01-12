import { FakeClock } from "@subspace/clock"
import {
  describeListableSecretVaultContract,
  describeReadableSecretVaultContract,
  describeSecretVaultContract,
  describeVersionedSecretVaultContract,
} from "../../../ports/__tests__/secret-vault.contract"
import { createFakeGcpSecretManagerTestClient } from "../../../tests/utils/create-gcp-secrets-manager-client"
import { deleteAllSecrets } from "../../../tests/utils/delete-all-secrets"
import { GcpSecretManagerVault } from "../gcp-secret-manager-vault"

describe("GcpSecretManagerVault", () => {
  let vault: GcpSecretManagerVault

  beforeAll(() => {
    const setup = createFakeGcpSecretManagerTestClient({
      clock: new FakeClock(),
    })

    vault = new GcpSecretManagerVault(
      {
        client: setup.client as any,
      },
      {
        projectId: setup.projectId,
        prefix: setup.keyspacePrefix,
      },
    )
  })

  afterAll(async () => {
    await deleteAllSecrets(vault)
  })

  describeReadableSecretVaultContract("GcpSecretManagerVault", async () => ({
    vault,
    seed: async (key, value) => vault.set(key, value),
    cleanup: async () => {
      await deleteAllSecrets(vault)
    },
  }))

  describeSecretVaultContract("GcpSecretManagerVault", async () => ({
    vault,
    cleanup: async () => {
      await deleteAllSecrets(vault)
    },
  }))

  it("rejects whitespace-only secret values", async () => {
    await expect(vault.set("whitespace-key", "   ")).rejects.toThrow()
  })

  describeListableSecretVaultContract("GcpSecretManagerVault", async () => ({
    vault,
    cleanup: async () => {
      await deleteAllSecrets(vault)
    },
  }))

  describeVersionedSecretVaultContract("GcpSecretManagerVault", async () => ({
    vault,
    cleanup: async () => {
      await deleteAllSecrets(vault)
    },
  }))
})
