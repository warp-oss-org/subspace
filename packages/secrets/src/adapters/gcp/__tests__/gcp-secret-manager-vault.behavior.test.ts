import { FakeClock } from "@subspace/clock"
import { createFakeGcpSecretManagerTestClient } from "../../../tests/utils/create-gcp-secrets-manager-client"
import { deleteAllSecrets } from "../../../tests/utils/delete-all-secrets"
import { GcpSecretManagerVault } from "../gcp-secret-manager-vault"

describe("GcpSecretManagerVault (behavior)", () => {
  let projectId: string
  let keyspacePrefix: string
  let client: any
  let vault: GcpSecretManagerVault

  beforeAll(() => {
    const testClient = createFakeGcpSecretManagerTestClient({
      clock: new FakeClock(),
    })
    client = testClient.client as any
    projectId = testClient.projectId
    keyspacePrefix = testClient.keyspacePrefix

    vault = new GcpSecretManagerVault({ client }, { projectId, prefix: keyspacePrefix })
  })

  const uniq = (prefix: string) => `${prefix}-${Math.random().toString(16).slice(2)}`

  afterEach(async () => {
    await deleteAllSecrets(vault)
  })

  afterAll(async () => {
    await deleteAllSecrets(vault)
  })

  describe("prefix handling", () => {
    it("applies prefix to secret names (keys returned are unprefixed)", async () => {
      await vault.set("my-secret", "my-value")

      const keys = await vault.list()
      expect(keys).toContain("my-secret")
      expect(keys).not.toContain(`${keyspacePrefix}my-secret`)
    })

    it("list() filters out secrets outside the vault prefix (same client)", async () => {
      const vaultOther = new GcpSecretManagerVault(
        { client },
        { projectId, prefix: `${keyspacePrefix}other-` },
      )

      await vault.set("mine", "v1")
      await vaultOther.set("mine", "v2")

      const keys = await vault.list()

      expect(keys).toContain("mine")
      expect(keys).not.toContain(`${keyspacePrefix}mine`)

      const otherKeys = await vaultOther.list()
      expect(otherKeys).toContain("mine")
    })

    it("two vaults with different prefixes do not interfere", async () => {
      const testClient = createFakeGcpSecretManagerTestClient({
        clock: new FakeClock(),
      })

      const vault2 = new GcpSecretManagerVault(
        { client: testClient.client as any },
        { projectId, prefix: `${keyspacePrefix}other-` },
      )

      await vault.set("shared-key", "vault1-value")
      await vault2.set("shared-key", "vault2-value")

      const result1 = await vault.get("shared-key")
      const result2 = await vault2.get("shared-key")

      expect(result1!.value).toBe("vault1-value")
      expect(result2!.value).toBe("vault2-value")

      await vault2.delete("shared-key")
    })

    it("list() includes secrets even when provider returns entries missing name", async () => {
      const key = uniq("missing-name")
      await vault.set(key, "v")

      const goodName = `projects/${projectId}/secrets/${keyspacePrefix}${key}`

      const spy = vi
        .spyOn(client, "listSecrets")
        .mockResolvedValueOnce([[{ name: undefined }, { name: goodName }] as any])

      const keys = await vault.list()
      expect(keys).toContain(key)

      spy.mockRestore()
    })

    it("list() without a vault prefix does not filter by prefix", async () => {
      const noPrefixVault = new GcpSecretManagerVault(
        { client },
        { projectId, prefix: "" },
      )

      const a = uniq("noprefix-a")
      const b = uniq("noprefix-b")

      await vault.set(a, "va")
      await vault.set(b, "vb")

      const keys = await noPrefixVault.list()

      expect(keys).toContain(`${keyspacePrefix}${a}`)
      expect(keys).toContain(`${keyspacePrefix}${b}`)

      await vault.delete(a)
      await vault.delete(b)
    })
  })

  describe("versioning behavior", () => {
    it("automatically creates versions on update", async () => {
      await vault.set("versioned-key", "v1")
      await vault.set("versioned-key", "v2")
      await vault.set("versioned-key", "v3")

      const versions = await vault.listVersions("versioned-key")
      expect(versions.length).toBeGreaterThanOrEqual(3)
    })

    it("marks only one version as current", async () => {
      await vault.set("current-test", "v1")
      await vault.set("current-test", "v2")

      const versions = await vault.listVersions("current-test")
      expect(versions.filter((v) => v.current)).toHaveLength(1)
    })

    it("retrieves historical version by ID", async () => {
      await vault.set("historical", "first-value")
      const v1 = (await vault.listVersions("historical"))[0]!.version

      await vault.set("historical", "second-value")

      const historical = await vault.getVersion("historical", v1)
      expect(historical!.value).toBe("first-value")
    })
  })

  describe("special values", () => {
    it("handles values with newlines", async () => {
      const pem = "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----"
      await vault.set("pem-cert", pem)

      const result = await vault.get("pem-cert")
      expect(result!.value).toBe(pem)
    })

    it("handles unicode values", async () => {
      const unicode = "密码 🔐 пароль"
      await vault.set("unicode-secret", unicode)

      const result = await vault.get("unicode-secret")
      expect(result!.value).toBe(unicode)
    })
  })

  describe("metadata / labels", () => {
    it("set() passes normalized labels to createSecret", async () => {
      const key = uniq("labels")

      const createSpy = vi.spyOn(client, "createSecret")

      await vault.set(key, "value", {
        metadata: {
          Env: "Prod",
          "team name": "Platform Ops",
          "1bad": "Weird*Value",
        },
      })

      expect(createSpy).toHaveBeenCalledTimes(1)

      const [{ secret }] = createSpy.mock.calls[0] as any
      expect(secret.labels).toEqual({
        env: "prod",
        team_name: "platform_ops",
        k_1bad: "weird_value",
      })

      createSpy.mockRestore()
    })

    it("set() omits labels when metadata normalizes to nothing", async () => {
      const key = uniq("no-labels")

      const createSpy = vi.spyOn(client, "createSecret")

      await vault.set(key, "value", {
        metadata: {
          "   ": "x",
          "\n\t": "y",
        },
      })

      expect(createSpy).toHaveBeenCalledTimes(1)

      const [{ secret }] = createSpy.mock.calls[0] as any
      expect(secret.labels).toBeUndefined()

      createSpy.mockRestore()
    })

    it("set() truncates labels to 63 chars", async () => {
      const key = uniq("truncate")

      const longKey = "a".repeat(80)
      const longValue = "b".repeat(100)

      const createSpy = vi.spyOn(client, "createSecret")

      await vault.set(key, "value", {
        metadata: {
          [longKey]: longValue,
        },
      })

      expect(createSpy).toHaveBeenCalledTimes(1)

      const [{ secret }] = createSpy.mock.calls[0] as any
      const labels = secret.labels as Record<string, string>

      const onlyKey = Object.keys(labels)[0]!
      const onlyValue = labels[onlyKey]!

      expect(onlyKey.length).toBeLessThanOrEqual(63)
      expect(onlyValue.length).toBeLessThanOrEqual(63)

      createSpy.mockRestore()
    })

    it("set() keeps empty label values (allowed) when key is valid", async () => {
      const key = uniq("empty-value")

      const createSpy = vi.spyOn(client, "createSecret")

      await vault.set(key, "value", {
        metadata: {
          ok: "   ",
        },
      })

      expect(createSpy).toHaveBeenCalledTimes(1)

      const [{ secret }] = createSpy.mock.calls[0] as any
      expect(secret.labels).toEqual({ ok: "" })

      createSpy.mockRestore()
    })
  })

  describe("failure paths", () => {
    it("get() throws on non-not-found provider errors", async () => {
      const key = uniq("boom-get")
      const spy = vi
        .spyOn(client, "accessSecretVersion")
        .mockRejectedValueOnce({ code: 13 })

      await expect(vault.get(key)).rejects.toThrow(
        new RegExp(`^Failed to get secret: ${key}$`),
      )

      spy.mockRestore()
    })

    it("get() returns null on not-found", async () => {
      const key = uniq("missing-get")
      const spy = vi
        .spyOn(client, "accessSecretVersion")
        .mockRejectedValueOnce({ code: 5 })

      await expect(vault.get(key)).resolves.toBeNull()

      spy.mockRestore()
    })

    it("get() defaults value to empty string when payload is missing", async () => {
      const key = uniq("empty-payload")
      const name = `projects/${projectId}/secrets/${keyspacePrefix}${key}/versions/latest`

      const spy = vi
        .spyOn(client, "accessSecretVersion")
        .mockResolvedValueOnce([{ name, payload: undefined } as any])

      const res = await vault.get(key)
      expect(res).not.toBeNull()
      expect(res!.value).toBe("")

      spy.mockRestore()
    })

    it("get() omits version when provider response has no name", async () => {
      const key = uniq("no-name")

      const spy = vi
        .spyOn(client, "accessSecretVersion")
        .mockResolvedValueOnce([
          { name: undefined, payload: { data: Buffer.from("x") } } as any,
        ])

      const res = await vault.get(key)
      expect(res).not.toBeNull()
      expect(res!.value).toBe("x")
      expect(res!.version).toBeUndefined()

      spy.mockRestore()
    })

    it("exists() throws on non-not-found provider errors", async () => {
      const key = uniq("boom-exists")
      const spy = vi.spyOn(client, "getSecret").mockRejectedValueOnce({ code: 13 })

      await expect(vault.exists(key)).rejects.toThrow(
        new RegExp(`^Failed to check secret: ${key}$`),
      )

      spy.mockRestore()
    })

    it("exists() returns false on not-found", async () => {
      const key = uniq("missing-exists")
      const spy = vi.spyOn(client, "getSecret").mockRejectedValueOnce({ code: 5 })

      await expect(vault.exists(key)).resolves.toBe(false)

      spy.mockRestore()
    })

    it("delete() throws on non-not-found provider errors", async () => {
      const key = uniq("boom-delete")
      const spy = vi.spyOn(client, "deleteSecret").mockRejectedValueOnce({ code: 13 })

      await expect(vault.delete(key)).rejects.toThrow(
        new RegExp(`^Failed to delete secret: ${key}$`),
      )

      spy.mockRestore()
    })

    it("delete() is idempotent on not-found", async () => {
      const key = uniq("missing-delete")
      const spy = vi.spyOn(client, "deleteSecret").mockRejectedValueOnce({ code: 5 })

      await expect(vault.delete(key)).resolves.toBeUndefined()

      spy.mockRestore()
    })

    it("list() throws on provider errors", async () => {
      const spy = vi.spyOn(client, "listSecrets").mockRejectedValueOnce({ code: 13 })

      await expect(vault.list("app/")).rejects.toThrow(
        new RegExp(`^Failed to list secrets: ${keyspacePrefix}app/$`),
      )

      spy.mockRestore()
    })

    it("getVersion() throws on provider errors", async () => {
      const key = uniq("boom-get-version")
      const version = "123"
      const spy = vi
        .spyOn(client, "accessSecretVersion")
        .mockRejectedValueOnce({ code: 13 })

      await expect(vault.getVersion(key, version)).rejects.toThrow(
        new RegExp(`^Failed to get secret version: ${key}@${version}$`),
      )

      spy.mockRestore()
    })

    it("getVersion() returns null on not-found", async () => {
      const key = uniq("missing-get-version")
      const version = "1"

      const spy = vi
        .spyOn(client, "accessSecretVersion")
        .mockRejectedValueOnce({ code: 5 })

      await expect(vault.getVersion(key, version)).resolves.toBeNull()

      spy.mockRestore()
    })

    it("listVersions() returns [] on not-found", async () => {
      const key = uniq("no-versions")
      const spy = vi
        .spyOn(client, "listSecretVersions")
        .mockRejectedValueOnce({ code: 5 })

      const versions = await vault.listVersions(key)
      expect(versions).toEqual([])

      spy.mockRestore()
    })

    it("listVersions() throws on provider errors", async () => {
      const key = uniq("boom-list-versions")
      const spy = vi
        .spyOn(client, "listSecretVersions")
        .mockRejectedValueOnce({ code: 13 })

      await expect(vault.listVersions(key)).rejects.toThrow(
        new RegExp(`^Failed to list secret versions: ${key}$`),
      )

      spy.mockRestore()
    })

    it.each([
      [""],
      ["   "],
      ["\n\t"],
    ])("set() rejects empty/whitespace (%s)", async (value) => {
      await expect(vault.set(uniq("empty"), value)).rejects.toThrow(
        /^Secret value must not be empty or whitespace:/,
      )
    })

    it("set() throws when addSecretVersion fails with non-not-found error", async () => {
      const key = uniq("boom-add")
      const spy = vi.spyOn(client, "addSecretVersion").mockRejectedValueOnce({ code: 13 })

      await expect(vault.set(key, "value")).rejects.toThrow(
        new RegExp(`^Failed to set secret: ${key}$`),
      )

      spy.mockRestore()
    })

    it("set() throws when createSecret fails with non-already-exists error", async () => {
      const key = uniq("boom-create")

      const addSpy = vi
        .spyOn(client, "addSecretVersion")
        .mockRejectedValueOnce({ code: 5 })
      const createSpy = vi
        .spyOn(client, "createSecret")
        .mockRejectedValueOnce({ code: 13 })

      await expect(vault.set(key, "value")).rejects.toThrow(
        new RegExp(`^Failed to set secret: ${key}$`),
      )

      addSpy.mockRestore()
      createSpy.mockRestore()
    })

    it("set() retries addSecretVersion when createSecret races with already-exists", async () => {
      const key = uniq("race")

      await client.createSecret({
        parent: `projects/${projectId}`,
        secretId: `${keyspacePrefix}${key}`,
        secret: { replication: { automatic: {} } },
      })

      const addSpy = vi.spyOn(client, "addSecretVersion")
      const createSpy = vi.spyOn(client, "createSecret")

      addSpy.mockRejectedValueOnce({ code: 5 })

      createSpy.mockRejectedValueOnce({ code: 6 })

      await vault.set(key, "value")

      expect(addSpy).toHaveBeenCalledTimes(2)
      expect(createSpy).toHaveBeenCalledTimes(1)

      addSpy.mockRestore()
      createSpy.mockRestore()

      const roundTrip = await vault.get(key)
      expect(roundTrip!.value).toBe("value")
    })

    it("list() ignores malformed secret names from the provider", async () => {
      const key = uniq("valid")
      await vault.set(key, "v")

      const goodName = `projects/${projectId}/secrets/${keyspacePrefix}${key}`

      const spy = vi
        .spyOn(client, "listSecrets")
        .mockResolvedValueOnce([[{ name: goodName }, { name: "nonsense" }] as any])

      const keys = await vault.list()
      expect(keys).toContain(key)
      expect(keys).not.toContain("nonsense")

      spy.mockRestore()
    })

    it("listVersions() computes current by highest ENABLED version and tolerates missing createTime", async () => {
      const key = uniq("versions")

      const parent = `projects/${projectId}/secrets/${keyspacePrefix}${key}`

      const spy = vi.spyOn(client, "listSecretVersions").mockResolvedValueOnce([
        [
          { name: `${parent}/versions/1`, state: "ENABLED", createTime: undefined },
          {
            name: `${parent}/versions/2`,
            state: "DISABLED",
            createTime: "2024-01-02T00:00:00Z",
          },
          {
            name: `${parent}/versions/3`,
            state: "ENABLED",
            createTime: "2024-01-03T00:00:00Z",
          },
        ] as any,
      ])

      const versions = await vault.listVersions(key)

      expect(versions.map((v) => v.version)).toEqual(["3", "2", "1"])
      expect(versions.filter((v) => v.current)).toHaveLength(1)
      expect(versions.find((v) => v.version === "3")?.current).toBe(true)

      const v1 = versions.find((v) => v.version === "1")

      expect(v1?.createdAt).toBeUndefined()

      spy.mockRestore()
    })

    it("list() returns sorted keys", async () => {
      const a = uniq("a")
      const m = uniq("m")
      const z = uniq("z")

      await vault.set(z, "z")
      await vault.set(a, "a")
      await vault.set(m, "m")

      const keys = await vault.list()
      expect(keys).toEqual([...keys].sort())
    })

    it("list(prefix) returns only matching keys", async () => {
      await vault.set("app/db", "1")
      await vault.set("app/api", "2")
      await vault.set("other/x", "3")

      const keys = await vault.list("app/")
      expect(keys).toContain("app/api")
      expect(keys).toContain("app/db")
      expect(keys).not.toContain("other/x")
    })

    it("listVersions() parses createTime when present", async () => {
      const key = uniq("time")
      const parent = `projects/${projectId}/secrets/${keyspacePrefix}${key}`

      const spy = vi.spyOn(client, "listSecretVersions").mockResolvedValueOnce([
        [
          {
            name: `${parent}/versions/1`,
            state: "ENABLED",
            createTime: "2024-01-01T00:00:00Z",
          },
        ] as any,
      ])

      const versions = await vault.listVersions(key)
      expect(versions).toHaveLength(1)
      expect(versions[0]!.createdAt).toBeInstanceOf(Date)
      expect(versions[0]!.createdAt!.toISOString()).toBe("2024-01-01T00:00:00.000Z")

      spy.mockRestore()
    })

    it("listVersions() marks no version current when none are ENABLED", async () => {
      const key = uniq("no-enabled")
      const parent = `projects/${projectId}/secrets/${keyspacePrefix}${key}`

      const spy = vi.spyOn(client, "listSecretVersions").mockResolvedValueOnce([
        [
          {
            name: `${parent}/versions/1`,
            state: "DISABLED",
            createTime: "2024-01-01T00:00:00Z",
          },
          {
            name: `${parent}/versions/2`,
            state: "DISABLED",
            createTime: "2024-01-02T00:00:00Z",
          },
        ] as any,
      ])

      const versions = await vault.listVersions(key)
      expect(versions.some((v) => v.current)).toBe(false)

      spy.mockRestore()
    })

    it("listVersions() ignores entries with missing or malformed version names", async () => {
      const key = uniq("malformed-versions")
      const parent = `projects/${projectId}/secrets/${keyspacePrefix}${key}`

      const spy = vi.spyOn(client, "listSecretVersions").mockResolvedValueOnce([
        [
          { name: undefined, state: "ENABLED", createTime: "2024-01-01T00:00:00Z" },
          {
            name: `${parent}/versions/not-a-number`,
            state: "ENABLED",
            createTime: "2024-01-02T00:00:00Z",
          },
          { name: `${parent}/versions/1`, state: "ENABLED", createTime: undefined },
          {
            name: `${parent}/versions/2`,
            state: "DISABLED",
            createTime: "2024-01-03T00:00:00Z",
          },
          {
            name: `${parent}/versions/3`,
            state: "ENABLED",
            createTime: "2024-01-04T00:00:00Z",
          },
        ] as any,
      ])

      const versions = await vault.listVersions(key)

      expect(versions.map((v) => v.version)).toEqual(["3", "2", "1"])
      expect(versions.filter((v) => v.current)).toHaveLength(1)
      expect(versions.find((v) => v.version === "3")?.current).toBe(true)

      spy.mockRestore()
    })
  })
})
