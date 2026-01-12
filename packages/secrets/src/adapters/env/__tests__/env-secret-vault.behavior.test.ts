import { EnvSecretVault } from "../env-secret-vault"

describe("EnvSecretVault behavior", () => {
  describe("read-only enforcement", () => {
    it("has no set method", () => {
      const vault = new EnvSecretVault()

      expect((vault as any).set).toBeUndefined()
    })

    it("has no delete method", () => {
      const vault = new EnvSecretVault()

      expect((vault as any).delete).toBeUndefined()
    })
  })

  describe("prefix handling", () => {
    it("reads from prefixed environment variables", async () => {
      const env = {
        APP_DATABASE_URL: "postgres://localhost/db",
        APP_API_KEY: "secret",
        OTHER_VAR: "ignored",
      }
      const vault = new EnvSecretVault({ prefix: "APP_", env })

      const dbUrl = await vault.get("DATABASE_URL")
      const apiKey = await vault.get("API_KEY")

      expect(dbUrl!.value).toBe("postgres://localhost/db")
      expect(apiKey!.value).toBe("secret")
    })

    it("returns null for non-prefixed keys when prefix is set", async () => {
      const env = {
        DATABASE_URL: "postgres://localhost/db",
      }
      const vault = new EnvSecretVault({ prefix: "APP_", env })

      const result = await vault.get("DATABASE_URL")

      // Looking for APP_DATABASE_URL, not DATABASE_URL
      expect(result).toBeNull()
    })

    it("works without prefix", async () => {
      const env = {
        DATABASE_URL: "postgres://localhost/db",
      }
      const vault = new EnvSecretVault({ env })

      const result = await vault.get("DATABASE_URL")

      expect(result!.value).toBe("postgres://localhost/db")
    })
  })

  describe("custom env object", () => {
    it("reads from custom env object instead of process.env", async () => {
      const customEnv = {
        CUSTOM_VAR: "custom-value",
      }
      const vault = new EnvSecretVault({ env: customEnv })

      const result = await vault.get("CUSTOM_VAR")

      expect(result!.value).toBe("custom-value")
    })

    it("is isolated from process.env changes", async () => {
      const customEnv = {
        ISOLATED_VAR: "isolated",
      }
      const vault = new EnvSecretVault({ env: customEnv })

      // Even if process.env had this var, we read from customEnv
      const result = await vault.get("ISOLATED_VAR")

      expect(result!.value).toBe("isolated")
    })
  })

  describe("SecretValue format", () => {
    it("returns minimal SecretValue (just value)", async () => {
      const env = { KEY: "value" }
      const vault = new EnvSecretVault({ env })

      const result = await vault.get("KEY")

      expect(result).toEqual({ value: "value" })
      expect(result!.metadata).toBeUndefined()
      expect(result!.version).toBeUndefined()
      expect(result!.updatedAt).toBeUndefined()
    })
  })

  describe("edge cases", () => {
    it("handles empty string values", async () => {
      const env = { EMPTY: "" }
      const vault = new EnvSecretVault({ env })

      const result = await vault.get("EMPTY")

      expect(result).not.toBeNull()
      expect(result!.value).toBe("")
    })

    it("distinguishes between empty string and undefined", async () => {
      const env: Record<string, string | undefined> = {
        EMPTY: "",
        UNDEFINED: undefined,
      }
      const vault = new EnvSecretVault({ env })

      expect(await vault.get("EMPTY")).not.toBeNull()
      expect(await vault.get("UNDEFINED")).toBeNull()
    })

    it("handles special characters in values", async () => {
      const env = {
        SPECIAL: "user:pass@host/path?query=1&other=2",
      }
      const vault = new EnvSecretVault({ env })

      const result = await vault.get("SPECIAL")

      expect(result!.value).toBe("user:pass@host/path?query=1&other=2")
    })

    it("handles newlines in values", async () => {
      const env = {
        MULTILINE: "line1\nline2\nline3",
      }
      const vault = new EnvSecretVault({ env })

      const result = await vault.get("MULTILINE")

      expect(result!.value).toBe("line1\nline2\nline3")
    })
  })

  describe("exists()", () => {
    it("returns true for defined variables", async () => {
      const env = { EXISTS: "value" }
      const vault = new EnvSecretVault({ env })

      expect(await vault.exists("EXISTS")).toBe(true)
    })

    it("returns true for empty string variables", async () => {
      const env = { EMPTY: "" }
      const vault = new EnvSecretVault({ env })

      expect(await vault.exists("EMPTY")).toBe(true)
    })

    it("returns false for undefined variables", async () => {
      const env: Record<string, string> = {}
      const vault = new EnvSecretVault({ env })

      expect(await vault.exists("MISSING")).toBe(false)
    })

    it("respects prefix for exists()", async () => {
      const env = {
        APP_VAR: "value",
        VAR: "other",
      }
      const vault = new EnvSecretVault({ prefix: "APP_", env })

      expect(await vault.exists("VAR")).toBe(true)
      expect(await vault.exists("OTHER")).toBe(false)
    })
  })
})
