import { FakeClock } from "@subspace/clock"
import { createFakeGcpSecretManagerTestClient } from "../../../tests/utils/create-gcp-secrets-manager-client"
import { GcpSecretManagerVault } from "../gcp-secret-manager-vault"

describe("GcpSecretManagerVault (integration)", () => {
  const clock = new FakeClock()
  let client: any
  let projectId: string
  let keyspacePrefix: string

  beforeEach(() => {
    const testClient = createFakeGcpSecretManagerTestClient({ clock })
    client = testClient.client
    projectId = testClient.projectId
    keyspacePrefix = testClient.keyspacePrefix
  })

  describe("prefix wiring", () => {
    it("persists secrets under prefixed IDs", async () => {
      const vault = new GcpSecretManagerVault(
        { client },
        { projectId, prefix: keyspacePrefix },
      )

      const key = "alpha"
      await vault.set(key, "value")

      const keys = await vault.list()

      expect(keys).toContain(key)
      expect(keys).not.toContain(`${keyspacePrefix}${key}`)
    })

    it("two vaults with different prefixes do not interfere", async () => {
      const vaultA = new GcpSecretManagerVault(
        { client },
        { projectId, prefix: `${keyspacePrefix}A/` },
      )
      const vaultB = new GcpSecretManagerVault(
        { client },
        { projectId, prefix: `${keyspacePrefix}B/` },
      )

      await vaultA.set("shared", "A")
      await vaultB.set("shared", "B")

      expect((await vaultA.get("shared"))!.value).toBe("A")
      expect((await vaultB.get("shared"))!.value).toBe("B")
    })
  })

  describe("provider timestamp wiring", () => {
    it("createdAt comes from injected clock", async () => {
      const fixed = new Date("2024-01-01T00:00:00Z")
      clock.set(fixed.getTime())

      const vault = new GcpSecretManagerVault(
        { client },
        { projectId, prefix: keyspacePrefix },
      )

      await vault.set("timed", "value")

      const versions = await vault.listVersions("timed")

      expect(versions[0]!.createdAt).toEqual(fixed)
    })
  })
})
