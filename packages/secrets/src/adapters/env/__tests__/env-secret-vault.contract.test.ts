import { describeReadableSecretVaultContract } from "../../../ports/__tests__/secret-vault.contract"
import { EnvSecretVault } from "../env-secret-vault"

describeReadableSecretVaultContract("EnvSecretVault", async () => {
  const env: Record<string, string> = {}
  const vault = new EnvSecretVault({ env })

  return {
    vault,
    seed: async (key, value) => {
      env[key] = value
    },
    cleanup: async () => {
      for (const key of Object.keys(env)) {
        delete env[key]
      }
    },
  }
})
