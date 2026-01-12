import { mkdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { FakeClock } from "@subspace/clock"
import {
  describeListableSecretVaultContract,
  describeReadableSecretVaultContract,
  describeSecretVaultContract,
} from "../../../ports/__tests__/secret-vault.contract"
import { JsonFileSecretVault } from "../json-file-secret-vault"

let testDir: string
let testCounter = 0

async function createTestDir(): Promise<string> {
  testDir = join(tmpdir(), `secrets-test-${Date.now()}-${testCounter++}`)
  await mkdir(testDir, { recursive: true })
  return testDir
}

async function cleanupTestDir(): Promise<void> {
  if (testDir) {
    await rm(testDir, { recursive: true, force: true })
  }
}

describeReadableSecretVaultContract("JsonFileSecretVault", async () => {
  const dir = await createTestDir()
  const path = join(dir, "secrets.json")
  const vault = new JsonFileSecretVault({ clock: new FakeClock() }, { path })

  return {
    vault,
    seed: async (key, value) => vault.set(key, value),
    cleanup: cleanupTestDir,
  }
})

describeSecretVaultContract("JsonFileSecretVault", async () => {
  const dir = await createTestDir()
  const path = join(dir, "secrets.json")
  const vault = new JsonFileSecretVault({ clock: new FakeClock() }, { path })

  return {
    vault,
    cleanup: cleanupTestDir,
  }
})

describeListableSecretVaultContract("JsonFileSecretVault", async () => {
  const dir = await createTestDir()
  const path = join(dir, "secrets.json")
  const vault = new JsonFileSecretVault({ clock: new FakeClock() }, { path })

  return {
    vault,
    cleanup: cleanupTestDir,
  }
})
