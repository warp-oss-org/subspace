import crypto from "node:crypto"
import type { SecretsManagerClient } from "@aws-sdk/client-secrets-manager"
import { createSecretsManagerTestClient } from "../../../tests/utils/create-aws-secrets-client"
import { deleteAllSecrets } from "../../../tests/utils/delete-all-secrets"
import { AwsSecretsManagerVault } from "../aws-secrets-manager-vault"

describe("AwsSecretsManagerVault (behavior)", () => {
  let client: SecretsManagerClient
  let keyspacePrefix: string
  let vault: AwsSecretsManagerVault

  beforeAll(() => {
    const testClient = createSecretsManagerTestClient()
    client = testClient.client
    keyspacePrefix = testClient.keyspacePrefix

    vault = new AwsSecretsManagerVault({ client }, { prefix: keyspacePrefix })
  })

  afterEach(async () => {
    await deleteAllSecrets(vault)
  })

  afterAll(async () => {
    await deleteAllSecrets(vault)
  })

  const uniq = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

  describe("prefix handling", () => {
    it("applies prefix to secret names (keys returned are unprefixed)", async () => {
      await vault.set("my-secret", "my-value")

      const keys = await vault.list()
      expect(keys).toContain("my-secret")
      expect(keys).not.toContain(`${keyspacePrefix}my-secret`)
    })

    it("two vaults with different prefixes do not interfere", async () => {
      const vault2 = new AwsSecretsManagerVault(
        { client },
        { prefix: `${keyspacePrefix}other/` },
      )

      await vault.set("shared-key", "vault1-value")
      await vault2.set("shared-key", "vault2-value")

      const result1 = await vault.get("shared-key")
      const result2 = await vault2.get("shared-key")

      expect(result1!.value).toBe("vault1-value")
      expect(result2!.value).toBe("vault2-value")

      await vault2.delete("shared-key")
    })

    it("normalizes leading slash in keys", async () => {
      const key = "/leading/slash"
      await vault.set(key, "v")

      const res = await vault.get("leading/slash")
      expect(res).not.toBeNull()
      expect(res!.value).toBe("v")
    })

    it("normalizes prefix to have leading and trailing slashes", async () => {
      const normalizedVault = new AwsSecretsManagerVault(
        { client },
        { prefix: "subspace-secrets-manager-normalize" },
      )

      const sendSpy = vi.spyOn(client, "send")

      await normalizedVault.set("k", "v")

      const updateCmd = sendSpy.mock.calls.find(
        ([cmd]) => (cmd as any).constructor?.name === "UpdateSecretCommand",
      )?.[0] as any

      const createCmd = sendSpy.mock.calls.find(
        ([cmd]) => (cmd as any).constructor?.name === "CreateSecretCommand",
      )?.[0] as any

      const secretId = (updateCmd?.input?.SecretId ?? createCmd?.input?.Name) as string

      expect(secretId.startsWith("/subspace-secrets-manager-normalize/")).toBe(true)

      sendSpy.mockRestore()
    })

    it("normalizes key by stripping leading slash", async () => {
      const sendSpy = vi.spyOn(client, "send")

      await vault.set("/leading", "v")

      const updateCmd = sendSpy.mock.calls.find(
        ([cmd]) => (cmd as any).constructor?.name === "UpdateSecretCommand",
      )?.[0] as any

      const createCmd = sendSpy.mock.calls.find(
        ([cmd]) => (cmd as any).constructor?.name === "CreateSecretCommand",
      )?.[0] as any

      const secretId = (updateCmd?.input?.SecretId ?? createCmd?.input?.Name) as string

      expect(secretId.endsWith("/leading")).toBe(true)
      expect(secretId.includes("//leading")).toBe(false)

      const res = await vault.get("leading")
      expect(res?.value).toBe("v")

      sendSpy.mockRestore()
    })

    it("list() does not send name filters when prefix is empty", async () => {
      const emptyPrefixVault = new AwsSecretsManagerVault({ client }, { prefix: "" })
      const sendSpy = vi.spyOn(client, "send")

      await emptyPrefixVault.list()

      const listCmd = sendSpy.mock.calls.find(
        ([cmd]) => (cmd as any).constructor?.name === "ListSecretsCommand",
      )?.[0] as any

      expect(listCmd).toBeDefined()
      expect(listCmd.input?.Filters ?? []).toEqual([])

      sendSpy.mockRestore()
    })
  })

  describe("set() wiring", () => {
    it("creates new secrets by falling back from UpdateSecret to CreateSecret", async () => {
      const key = uniq("create-fallback")

      const sendSpy = vi.spyOn(client, "send")

      await vault.set(key, "value")

      const commandNames = sendSpy.mock.calls.map(
        ([cmd]) => (cmd as any).constructor?.name,
      )

      expect(commandNames).toContain("UpdateSecretCommand")
      expect(commandNames).toContain("CreateSecretCommand")

      const res = await vault.get(key)
      expect(res).not.toBeNull()
      expect(res!.value).toBe("value")

      sendSpy.mockRestore()
    })

    it("passes metadata as AWS tags", async () => {
      const key = uniq("tags")

      const sendSpy = vi.spyOn(client, "send")

      await vault.set(key, "value", {
        metadata: { env: "test", owner: "team-a" },
      })

      const cmds = sendSpy.mock.calls
        .map(([cmd]) => cmd as any)
        .filter(
          (cmd) =>
            cmd?.constructor?.name === "UpdateSecretCommand" ||
            cmd?.constructor?.name === "CreateSecretCommand",
        )

      expect(cmds.length).toBeGreaterThan(0)

      const found = cmds.find((cmd) => {
        const input = cmd.input
        const id = (input?.SecretId ?? input?.Name) as string | undefined
        return typeof id === "string" && id.endsWith(key)
      })

      expect(found).toBeDefined()

      const input = (found as any).input
      const tags = input.Tags as Array<{ Key: string; Value: string }> | undefined

      expect(tags).toEqual(
        expect.arrayContaining([
          { Key: "env", Value: "test" },
          { Key: "owner", Value: "team-a" },
        ]),
      )

      sendSpy.mockRestore()
    })

    it("passes kmsKeyId through to AWS (UpdateSecret/CreateSecret)", async () => {
      const kmsKeyId = "test-kms-key-id"
      const kmsVault = new AwsSecretsManagerVault(
        { client },
        { prefix: keyspacePrefix, kmsKeyId },
      )

      const key = uniq("kms")

      const sendSpy = vi.spyOn(client, "send")

      await kmsVault.set(key, "value")

      const relevant = sendSpy.mock.calls
        .map(([cmd]) => cmd as any)
        .filter(
          (cmd) =>
            cmd?.constructor?.name === "UpdateSecretCommand" ||
            cmd?.constructor?.name === "CreateSecretCommand",
        )
        .filter((cmd) => {
          const input = cmd.input
          const id = (input?.SecretId ?? input?.Name) as string | undefined
          return typeof id === "string" && id.endsWith(key)
        })

      expect(relevant.length).toBeGreaterThan(0)

      for (const cmd of relevant) {
        expect(cmd.input?.KmsKeyId).toBe(kmsKeyId)
      }

      const res = await kmsVault.get(key)
      expect(res?.value).toBe("value")

      sendSpy.mockRestore()
    })
  })

  describe("error handling", () => {
    it("returns null for non-existent secret", async () => {
      const result = await vault.get("definitely-does-not-exist")
      expect(result).toBeNull()
    })

    it("returns false for exists() on non-existent secret", async () => {
      const result = await vault.exists("definitely-does-not-exist")
      expect(result).toBe(false)
    })

    it("delete is idempotent", async () => {
      await vault.delete("never-existed")
      await vault.delete("never-existed")
    })
  })

  describe("failure paths", () => {
    it("get() throws Error on non-not-found provider errors", async () => {
      const originalSend = client.send.bind(client)
      const sendSpy = vi.spyOn(client, "send").mockImplementation(async (cmd: any) => {
        if (cmd?.constructor?.name === "GetSecretValueCommand") {
          const err: any = new Error("boom")
          err.name = "SomeOtherException"
          throw err
        }
        return originalSend(cmd)
      })

      await expect(vault.get(uniq("boom-get"))).rejects.toThrow(/^Failed to get secret: /)

      sendSpy.mockRestore()
    })

    it("exists() throws Error on non-not-found provider errors", async () => {
      const originalSend = client.send.bind(client)
      const sendSpy = vi.spyOn(client, "send").mockImplementation(async (cmd: any) => {
        if (cmd?.constructor?.name === "DescribeSecretCommand") {
          const err: any = new Error("boom")
          err.name = "SomeOtherException"
          throw err
        }
        return originalSend(cmd)
      })

      await expect(vault.exists(uniq("boom-exists"))).rejects.toThrow(
        /^Failed to check secret: /,
      )

      sendSpy.mockRestore()
    })

    it("delete() throws Error on provider errors", async () => {
      const originalSend = client.send.bind(client)
      const sendSpy = vi.spyOn(client, "send").mockImplementation(async (cmd: any) => {
        if (cmd?.constructor?.name === "DeleteSecretCommand") {
          const err: any = new Error("boom")
          err.name = "SomeOtherException"
          throw err
        }
        return originalSend(cmd)
      })

      await expect(vault.delete(uniq("boom-delete"))).rejects.toThrow(
        /^Failed to delete secret: /,
      )

      sendSpy.mockRestore()
    })

    it("set() throws Error on provider errors", async () => {
      const originalSend = client.send.bind(client)
      const sendSpy = vi.spyOn(client, "send").mockImplementation(async (cmd: any) => {
        if (cmd?.constructor?.name === "UpdateSecretCommand") {
          const err: any = new Error("boom")
          err.name = "SomeOtherException"
          throw err
        }
        return originalSend(cmd)
      })

      await expect(vault.set(uniq("boom-set"), "value")).rejects.toThrow(
        /^Failed to set secret: /,
      )

      sendSpy.mockRestore()
    })

    it("list() throws Error on provider errors", async () => {
      const originalSend = client.send.bind(client)
      const sendSpy = vi.spyOn(client, "send").mockImplementation(async (cmd: any) => {
        if (cmd?.constructor?.name === "ListSecretsCommand") {
          const err: any = new Error("boom")
          err.name = "SomeOtherException"
          throw err
        }
        return originalSend(cmd)
      })

      await expect(vault.list()).rejects.toThrow(/^Failed to list secret: /)

      sendSpy.mockRestore()
    })

    it("getVersion() throws Error on non-not-found provider errors", async () => {
      const key = uniq("boom-get-version")
      await vault.set(key, "v1")

      const originalSend = client.send.bind(client)
      const sendSpy = vi.spyOn(client, "send").mockImplementation(async (cmd: any) => {
        if (cmd?.constructor?.name === "GetSecretValueCommand") {
          const input = cmd.input as any
          if (input?.VersionId === "boom") {
            const err: any = new Error("boom")
            err.name = "SomeOtherException"
            throw err
          }
        }
        return originalSend(cmd)
      })

      await expect(vault.getVersion(key, "boom")).rejects.toThrow(
        /^Failed to .*version.*secret: /,
      )

      sendSpy.mockRestore()
    })

    it("listVersions() throws Error on provider errors", async () => {
      const key = uniq("boom-list-versions")
      await vault.set(key, "v1")

      const originalSend = client.send.bind(client)
      const sendSpy = vi.spyOn(client, "send").mockImplementation(async (cmd: any) => {
        if (cmd?.constructor?.name === "ListSecretVersionIdsCommand") {
          const err: any = new Error("boom")
          err.name = "SomeOtherException"
          throw err
        }
        return originalSend(cmd)
      })

      await expect(vault.listVersions(key)).rejects.toThrow(/^Failed to list versions? /)

      sendSpy.mockRestore()
    })
  })

  describe("list filtering", () => {
    it("filters by prefix", async () => {
      await vault.set("app/db-url", "postgres://...")
      await vault.set("app/api-key", "secret")
      await vault.set("other/config", "value")

      const appKeys = await vault.list("app/")
      expect(appKeys).toContain("app/db-url")
      expect(appKeys).toContain("app/api-key")
      expect(appKeys).not.toContain("other/config")
    })

    it("returns sorted keys", async () => {
      await vault.set("zebra", "z")
      await vault.set("alpha", "a")
      await vault.set("beta", "b")

      const keys = await vault.list()
      expect(keys).toEqual([...keys].sort())
    })
  })

  describe("special values", () => {
    it("handles values with newlines", async () => {
      const pem = "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----"
      await vault.set("pem-cert", pem)

      const result = await vault.get("pem-cert")
      expect(result!.value).toBe(pem)
    })

    it("handles JSON values", async () => {
      const json = JSON.stringify({ key: "value", nested: { a: 1 } })
      await vault.set("json-config", json)

      const result = await vault.get("json-config")
      expect(result!.value).toBe(json)
    })

    it("handles unicode values", async () => {
      const unicode = "密码 🔐 пароль"
      await vault.set("unicode-secret", unicode)

      const result = await vault.get("unicode-secret")
      expect(result!.value).toBe(unicode)
    })
  })

  describe("version APIs", () => {
    it("listVersions returns versions with exactly one current", async () => {
      const key = uniq("versions")

      await vault.set(key, "v1")
      await vault.set(key, "v2")

      const versions = await vault.listVersions(key)

      expect(versions.length).toBeGreaterThanOrEqual(2)
      expect(versions.filter((v) => v.current)).toHaveLength(1)

      const times = versions.map((v) => v.createdAt?.getTime() ?? 0)
      expect(times).toEqual([...times].sort((a, b) => b - a))
    })

    it("getVersion returns historical value", async () => {
      const key = uniq("historical")

      await vault.set(key, "first")
      const current = await vault.get(key)
      expect(current?.version).toBeDefined()

      await vault.set(key, "second")

      const historical = await vault.getVersion(key, current!.version!)
      expect(historical).not.toBeNull()
      expect(historical!.value).toBe("first")
    })
  })

  describe("updatedAt handling", () => {
    it("returns updatedAt on get", async () => {
      await vault.set("timestamped", "value")
      const result = await vault.get("timestamped")
      expect(result!.updatedAt).toBeInstanceOf(Date)
    })
  })
})
