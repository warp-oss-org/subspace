import {
  DeleteParameterCommand,
  GetParameterCommand,
  PutParameterCommand,
  type SSMClient,
} from "@aws-sdk/client-ssm"
import { vi } from "vitest"
import { createSsmTestClient } from "../../../tests/utils/create-aws-secrets-client"
import { deleteAllSecrets } from "../../../tests/utils/delete-all-secrets"
import { AwsSsmVault } from "../aws-ssm-vault"

describe("AwsSsmVault (behavior)", () => {
  let client: SSMClient
  let keyspacePrefix: string
  let vault: AwsSsmVault

  beforeAll(() => {
    const testClient = createSsmTestClient()
    client = testClient.client
    keyspacePrefix = testClient.keyspacePrefix

    vault = new AwsSsmVault({ client }, { prefix: keyspacePrefix })
  })

  afterEach(async () => {
    await deleteAllSecrets(vault)
  })

  afterAll(async () => {
    await deleteAllSecrets(vault)
  })

  describe("prefix handling", () => {
    it("applies prefix to parameter names (keys returned are unprefixed)", async () => {
      await vault.set("my-param", "my-value")

      const keys = await vault.list()
      expect(keys).toContain("my-param")
      expect(keys).not.toContain(`${keyspacePrefix}my-param`)
    })

    it("two vaults with different prefixes do not interfere", async () => {
      const vault2 = new AwsSsmVault({ client }, { prefix: `${keyspacePrefix}other/` })

      await vault.set("shared-key", "vault1-value")
      await vault2.set("shared-key", "vault2-value")

      const result1 = await vault.get("shared-key")
      const result2 = await vault2.get("shared-key")

      expect(result1!.value).toBe("vault1-value")
      expect(result2!.value).toBe("vault2-value")

      await vault2.delete("shared-key")
    })

    it("normalizes prefix to have a leading and trailing '/'", async () => {
      const prefixedVault = new AwsSsmVault(
        { client },
        { prefix: "no-leading-or-trailing" },
      )

      const sendSpy = vi.spyOn(client, "send").mockImplementation(async (cmd: any) => {
        if (cmd instanceof PutParameterCommand) {
          const name: string | undefined = cmd.input?.Name
          expect(typeof name).toBe("string")
          expect(name).toMatch(/^\/no-leading-or-trailing\//)
          expect(name).not.toMatch(/^\/\/no-leading-or-trailing\//)
        }
        return {} as any
      })

      await prefixedVault.set("my-key", "value")

      sendSpy.mockRestore()
    })

    it("normalizes keys by stripping a leading '/'", async () => {
      const sendSpy = vi.spyOn(client, "send").mockImplementation(async (cmd: any) => {
        if (cmd instanceof PutParameterCommand) {
          const name: string | undefined = cmd.input?.Name
          expect(typeof name).toBe("string")
          expect(name).toContain(
            `${keyspacePrefix.startsWith("/") ? "" : "/"}${keyspacePrefix}`,
          )
          expect(name).not.toContain("//")
          expect(name).toMatch(/\/leading-slash$/)
        }
        return {} as any
      })

      await vault.set("/leading-slash", "value")

      sendSpy.mockRestore()
    })
  })

  describe("parameter type", () => {
    it("uses SecureString by default", async () => {
      await vault.set("secure-param", "secret-value")
      const result = await vault.get("secure-param")
      expect(result!.value).toBe("secret-value")
    })

    it("accepts String type", async () => {
      const stringVault = new AwsSsmVault(
        { client },
        { prefix: keyspacePrefix, parameterType: "String" },
      )

      await stringVault.set("string-param", "plain-value")

      const result = await stringVault.get("string-param")
      expect(result!.value).toBe("plain-value")
    })
  })

  describe("version handling", () => {
    it("returns version as string", async () => {
      await vault.set("versioned", "v1")
      const result = await vault.get("versioned")
      expect(typeof result!.version).toBe("string")
    })

    it("increments version on update", async () => {
      await vault.set("incrementing", "v1")
      const v1 = await vault.get("incrementing")

      await vault.set("incrementing", "v2")
      const v2 = await vault.get("incrementing")

      expect(parseInt(v2!.version!, 10)).toBeGreaterThan(parseInt(v1!.version!, 10))
    })
  })

  describe("error handling", () => {
    it("returns null for non-existent parameter", async () => {
      const result = await vault.get("definitely-does-not-exist")
      expect(result).toBeNull()
    })

    it("returns false for exists() on non-existent parameter", async () => {
      const result = await vault.exists("definitely-does-not-exist")
      expect(result).toBe(false)
    })

    it("delete is idempotent", async () => {
      await vault.delete("never-existed")
      await vault.delete("never-existed")
    })
  })

  describe("list behavior", () => {
    it("uses recursive listing", async () => {
      await vault.set("level1/level2/deep", "value")
      await vault.set("level1/shallow", "value")

      const keys = await vault.list()
      expect(keys).toContain("level1/level2/deep")
      expect(keys).toContain("level1/shallow")
    })

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

  describe("list wiring", () => {
    it("normalizes list path to end with '/'", async () => {
      const sendSpy = vi.spyOn(client, "send").mockImplementation(async (cmd: any) => {
        if (cmd?.constructor?.name === "GetParametersByPathCommand") {
          const normalizedPrefix = keyspacePrefix.replace(/^\/+/, "")
          const expectedPath = `/${normalizedPrefix}app/`
          expect(cmd.input?.Path).toEqual(expectedPath)
          return { Parameters: [], NextToken: undefined } as any
        }
        return {} as any
      })

      await vault.list("app")

      sendSpy.mockRestore()
    })

    it("uses '/' when prefix resolves to empty path", async () => {
      const rootVault = new AwsSsmVault({ client }, { prefix: "" })

      const sendSpy = vi.spyOn(client, "send").mockImplementation(async (cmd: any) => {
        if (cmd?.constructor?.name === "GetParametersByPathCommand") {
          expect(cmd.input?.Path).toBe("/")
          return { Parameters: [], NextToken: undefined } as any
        }
        return {} as any
      })

      await rootVault.list()

      sendSpy.mockRestore()
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
      await vault.set("unicode-param", unicode)

      const result = await vault.get("unicode-param")
      expect(result!.value).toBe(unicode)
    })
  })

  describe("updatedAt handling", () => {
    it("returns updatedAt (LastModifiedDate) on get", async () => {
      await vault.set("timestamped", "value")
      const result = await vault.get("timestamped")
      expect(result!.updatedAt).toBeInstanceOf(Date)
    })
  })
  describe("metadata", () => {
    it("sends AddTagsToResource when metadata is provided", async () => {
      const sendSpy = vi.spyOn(client, "send") as unknown as {
        mock: { calls: Array<[unknown]> }
        mockRestore: () => void
      }

      const key = "meta-tagged"
      await vault.set(key, "value", { metadata: { env: "test", owner: "team-a" } })

      const sentCommands = sendSpy.mock.calls.map(([cmd]) => cmd)

      const hasPut = sentCommands.some(
        (c) => c?.constructor?.name === "PutParameterCommand",
      )
      const hasTags = sentCommands.some(
        (c) => c?.constructor?.name === "AddTagsToResourceCommand",
      )

      expect(hasPut).toBe(true)
      expect(hasTags).toBe(true)

      const tagsCmd = sentCommands.find(
        (c) => c?.constructor?.name === "AddTagsToResourceCommand",
      ) as any

      expect(tagsCmd).toBeDefined()
      expect(tagsCmd.input?.ResourceType).toBe("Parameter")

      sendSpy.mockRestore()
    })
  })

  describe("kms key", () => {
    it("accepts kmsKeyId option (does not break String parameter type)", async () => {
      const kmsVault = new AwsSsmVault(
        { client },
        {
          prefix: keyspacePrefix,
          parameterType: "String",
          kmsKeyId: "alias/does-not-matter-in-string-mode",
        },
      )

      await kmsVault.set("kms-string", "plain")
      const result = await kmsVault.get("kms-string")
      expect(result!.value).toBe("plain")
    })
  })

  describe("failure paths", () => {
    it("get() throws on non-not-found provider errors", async () => {
      const sendSpy = vi.spyOn(client, "send").mockImplementation(async (cmd: any) => {
        if (cmd instanceof GetParameterCommand) throw new Error("boom")
        return {} as any
      })

      await expect(vault.get("boom-get")).rejects.toThrow(/^Failed to get parameter: /)

      sendSpy.mockRestore()
    })

    it("exists() throws on non-not-found provider errors", async () => {
      const sendSpy = vi.spyOn(client, "send").mockImplementation(async (cmd: any) => {
        if (cmd instanceof GetParameterCommand) throw new Error("boom")
        return {} as any
      })

      await expect(vault.exists("boom-exists")).rejects.toThrow(
        /^Failed to exists parameter: /,
      )

      sendSpy.mockRestore()
    })

    it("delete() throws on non-not-found provider errors", async () => {
      const sendSpy = vi.spyOn(client, "send").mockImplementation(async (cmd: any) => {
        if (cmd instanceof DeleteParameterCommand) throw new Error("boom")
        return {} as any
      })

      await expect(vault.delete("boom-delete")).rejects.toThrow(
        /^Failed to delete parameter: /,
      )

      sendSpy.mockRestore()
    })

    it("set() throws on provider errors", async () => {
      const sendSpy = vi.spyOn(client, "send").mockImplementation(async (cmd: any) => {
        if (cmd instanceof PutParameterCommand) throw new Error("boom")
        return {} as any
      })

      await expect(vault.set("boom-set", "value")).rejects.toThrow(
        /^Failed to set parameter: /,
      )

      sendSpy.mockRestore()
    })

    it("list() throws on provider errors", async () => {
      const sendSpy = vi.spyOn(client, "send").mockImplementation(async (cmd: any) => {
        if (cmd?.constructor?.name === "GetParametersByPathCommand")
          throw new Error("boom")
        return {} as any
      })

      await expect(vault.list()).rejects.toThrow(/^Failed to list parameter: /)

      sendSpy.mockRestore()
    })
  })
})
