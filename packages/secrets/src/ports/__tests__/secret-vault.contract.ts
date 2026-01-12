import type {
  ListableSecretVault,
  ReadableSecretVault,
  SecretVault,
  VersionedSecretVault,
} from "../secret-vault"

export function describeSecretVaultContract(
  name: string,
  factory: () => Promise<{
    vault: SecretVault
    cleanup?: () => Promise<void>
  }>,
) {
  describe(`SecretVault contract: ${name}`, () => {
    let vault: SecretVault
    let cleanup: (() => Promise<void>) | undefined

    beforeEach(async () => {
      const result = await factory()
      vault = result.vault
      cleanup = result.cleanup
    })

    afterEach(async () => {
      await cleanup?.()
    })

    describe("set()", () => {
      it("creates a new secret", async () => {
        await vault.set("new-key", "new-value")

        const result = await vault.get("new-key")
        expect(result!.value).toBe("new-value")
      })

      it("overwrites an existing secret", async () => {
        await vault.set("overwrite-key", "original")
        await vault.set("overwrite-key", "updated")

        const result = await vault.get("overwrite-key")
        expect(result!.value).toBe("updated")
      })

      it("rejects empty string values", async () => {
        await expect(vault.set("empty-key", "")).rejects.toThrow()
      })

      it("handles values with special characters", async () => {
        const value = "user:pass@host/db?ssl=true"
        await vault.set("special-key", value)

        const result = await vault.get("special-key")
        expect(result!.value).toBe(value)
      })

      it("handles large values", async () => {
        const value = "x".repeat(10000)
        await vault.set("large-key", value)

        const result = await vault.get("large-key")
        expect(result!.value).toBe(value)
      })

      it("handles JSON string values", async () => {
        const value = JSON.stringify({ key: "value", nested: { a: 1 } })
        await vault.set("json-key", value)

        const result = await vault.get("json-key")
        expect(result!.value).toBe(value)
        expect(JSON.parse(result!.value)).toEqual({ key: "value", nested: { a: 1 } })
      })
    })

    describe("delete()", () => {
      it("removes an existing secret", async () => {
        await vault.set("delete-me", "value")
        await vault.delete("delete-me")

        const result = await vault.get("delete-me")
        expect(result).toBeNull()
      })

      it("is idempotent for non-existent secrets", async () => {
        await vault.delete("never-existed")
        await vault.delete("never-existed")
      })

      it("only deletes the specified secret", async () => {
        await vault.set("keep-me", "value1")
        await vault.set("delete-me", "value2")

        await vault.delete("delete-me")

        const kept = await vault.get("keep-me")
        expect(kept!.value).toBe("value1")
      })
    })

    describe("set() with options", () => {
      it("accepts metadata option", async () => {
        await vault.set("meta-key", "value", {
          metadata: { env: "test", owner: "team-a" },
        })

        const result = await vault.get("meta-key")
        expect(result!.value).toBe("value")
      })
    })

    describe("round-trip integrity", () => {
      it.each([
        ["simple"],
        ["  spaces  "],
        ["line1\nline2"],
        ["line1\nline2\n"],
        ["\nstarts-with-newline"],
        ["line1\r\nline2\r\n"],
        ["tab\there"],
        ["null\x00byte"],
        ['{"json": true}'],
        ["emoji: 🔐🔑"],
        ["emoji zwj: 👨‍👩‍👧‍👦"],
        ["Zalgo: z̷͌͠ͅa̴̽͜͝l̶͙͆g̴̻͂o̶"],
        ["C:\\Users\\name\\file.txt"],
        ["\\n is two chars, not newline"],
      ])("preserves exact value through set/get cycle (%s)", async (value) => {
        const key = `roundtrip-${Math.random()}`
        await vault.set(key, value)

        const result = await vault.get(key)
        expect(result!.value).toBe(value)
      })
    })
  })
}

export function describeReadableSecretVaultContract(
  name: string,
  factory: () => Promise<{
    vault: ReadableSecretVault
    seed: (key: string, value: string) => Promise<void>
    cleanup?: () => Promise<void>
  }>,
) {
  describe(`ReadableSecretVault contract: ${name}`, () => {
    let vault: ReadableSecretVault
    let seed: (key: string, value: string) => Promise<void>
    let cleanup: (() => Promise<void>) | undefined

    beforeEach(async () => {
      const result = await factory()
      vault = result.vault
      seed = result.seed
      cleanup = result.cleanup
    })

    afterEach(async () => {
      await cleanup?.()
    })

    describe("get()", () => {
      it("returns SecretValue for existing secret", async () => {
        await seed("test-key", "test-value")

        const result = await vault.get("test-key")

        expect(result).not.toBeNull()
        expect(result!.value).toBe("test-value")
      })

      it("returns null for non-existent secret", async () => {
        const result = await vault.get("does-not-exist")

        expect(result).toBeNull()
      })

      it("SecretValue.value is always a string", async () => {
        await seed("string-test", "hello world")

        const result = await vault.get("string-test")

        expect(typeof result!.value).toBe("string")
      })

      it("handles keys with special characters", async () => {
        const key = "my/app/database-url"
        await seed(key, "postgres://...")

        const result = await vault.get(key)

        expect(result!.value).toBe("postgres://...")
      })

      it("handles values with special characters", async () => {
        const value = 'pass=word with spaces & "quotes"'
        await seed("special", value)

        const result = await vault.get("special")

        expect(result!.value).toBe(value)
      })

      it("handles unicode values", async () => {
        const value = "密码 🔐 пароль"
        await seed("unicode", value)

        const result = await vault.get("unicode")

        expect(result!.value).toBe(value)
      })
    })

    describe("exists()", () => {
      it("returns true for existing secret", async () => {
        await seed("exists-test", "value")

        const result = await vault.exists("exists-test")

        expect(result).toBe(true)
      })

      it("returns false for non-existent secret", async () => {
        const result = await vault.exists("does-not-exist")

        expect(result).toBe(false)
      })
    })
  })
}

export function describeVersionedSecretVaultContract(
  name: string,
  factory: () => Promise<{
    vault: SecretVault & VersionedSecretVault
    cleanup?: () => Promise<void>
  }>,
) {
  describe(`VersionedSecretVault contract: ${name}`, () => {
    let vault: SecretVault & VersionedSecretVault
    let cleanup: (() => Promise<void>) | undefined

    beforeEach(async () => {
      const result = await factory()
      vault = result.vault
      cleanup = result.cleanup
    })

    afterEach(async () => {
      await cleanup?.()
    })

    describe("getVersion()", () => {
      it("returns specific version of a secret", async () => {
        await vault.set("versioned-key", "value-v1")
        const v1 = await vault.get("versioned-key")

        await vault.set("versioned-key", "value-v2")

        const result = await vault.getVersion("versioned-key", v1!.version!)

        expect(result!.value).toBe("value-v1")
      })

      it("returns null for non-existent version", async () => {
        await vault.set("versioned-key", "value")

        const result = await vault.getVersion("versioned-key", "non-existent-version")

        expect(result).toBeNull()
      })

      it("returns null for non-existent key", async () => {
        const result = await vault.getVersion("no-such-key", "v1")

        expect(result).toBeNull()
      })

      it("includes version in returned SecretValue", async () => {
        await vault.set("versioned-key", "value")
        const current = await vault.get("versioned-key")

        const result = await vault.getVersion("versioned-key", current!.version!)

        expect(result!.version).toBe(current!.version)
      })
    })

    describe("listVersions()", () => {
      it("returns empty array for non-existent key", async () => {
        const result = await vault.listVersions("no-such-key")

        expect(result).toEqual([])
      })

      it("returns all versions of a secret", async () => {
        await vault.set("multi-version", "v1")
        await vault.set("multi-version", "v2")
        await vault.set("multi-version", "v3")

        const versions = await vault.listVersions("multi-version")

        expect(versions.length).toBeGreaterThanOrEqual(3)
      })

      it("each version has required fields", async () => {
        await vault.set("version-fields", "value")

        const versions = await vault.listVersions("version-fields")

        expect(versions.length).toBeGreaterThanOrEqual(1)
        for (const v of versions) {
          expect(v).toHaveProperty("version")
          expect(v).toHaveProperty("createdAt")
          expect(v).toHaveProperty("current")
          expect(v.createdAt).toBeInstanceOf(Date)
          expect(typeof v.current).toBe("boolean")
        }
      })

      it("exactly one version is marked as current", async () => {
        await vault.set("current-test", "v1")
        await vault.set("current-test", "v2")

        const versions = await vault.listVersions("current-test")
        const currentVersions = versions.filter((v) => v.current)

        expect(currentVersions.length).toBe(1)
      })

      it("current version matches get() result", async () => {
        await vault.set("match-test", "v1")
        await vault.set("match-test", "v2")

        const current = await vault.get("match-test")
        const versions = await vault.listVersions("match-test")
        const currentVersion = versions.find((v) => v.current)

        expect(currentVersion!.version).toBe(current!.version)
      })
    })
  })
}

export function describeListableSecretVaultContract(
  name: string,
  factory: () => Promise<{
    vault: SecretVault & ListableSecretVault
    cleanup?: () => Promise<void>
  }>,
) {
  describe(`ListableSecretVault contract: ${name}`, () => {
    let vault: SecretVault & ListableSecretVault
    let cleanup: (() => Promise<void>) | undefined

    beforeEach(async () => {
      const result = await factory()
      vault = result.vault
      cleanup = result.cleanup
    })

    afterEach(async () => {
      await cleanup?.()
    })

    describe("list()", () => {
      it("returns empty array when no secrets exist", async () => {
        const result = await vault.list()

        expect(result).toEqual([])
      })

      it("returns all secret keys", async () => {
        await vault.set("key1", "value1")
        await vault.set("key2", "value2")
        await vault.set("key3", "value3")

        const result = await vault.list()

        expect(result).toContain("key1")
        expect(result).toContain("key2")
        expect(result).toContain("key3")
      })

      it("returns keys sorted alphabetically", async () => {
        await vault.set("zebra", "z")
        await vault.set("alpha", "a")
        await vault.set("beta", "b")

        const result = await vault.list()

        expect(result).toEqual(["alpha", "beta", "zebra"])
      })

      it("filters by prefix when provided", async () => {
        await vault.set("app/db-url", "postgres://...")
        await vault.set("app/api-key", "secret")
        await vault.set("other/stuff", "value")

        const result = await vault.list("app/")

        expect(result).toContain("app/db-url")
        expect(result).toContain("app/api-key")
        expect(result).not.toContain("other/stuff")
      })

      it("returns empty array when prefix matches nothing", async () => {
        await vault.set("key1", "value1")

        const result = await vault.list("no-match/")

        expect(result).toEqual([])
      })

      it("updates after set/delete operations", async () => {
        await vault.set("key1", "value1")
        let result = await vault.list()
        expect(result).toContain("key1")

        await vault.delete("key1")
        result = await vault.list()
        expect(result).not.toContain("key1")
      })
    })
  })
}
