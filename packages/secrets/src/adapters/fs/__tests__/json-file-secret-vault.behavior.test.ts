import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { FakeClock } from "@subspace/clock"
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

describe("JsonFileSecretVault behavior", () => {
  let testPath: string

  beforeEach(async () => {
    const dir = await createTestDir()
    testPath = join(dir, "test-secrets.json")
  })

  afterEach(async () => {
    await cleanupTestDir()
  })

  it("creates file on first write", async () => {
    const vault = new JsonFileSecretVault({ clock: new FakeClock() }, { path: testPath })

    await vault.set("key", "value")

    const content = await readFile(testPath, "utf-8")
    const data = JSON.parse(content)
    expect(data.key.value).toBe("value")
  })

  it("preserves JSON structure", async () => {
    const vault = new JsonFileSecretVault({ clock: new FakeClock() }, { path: testPath })

    await vault.set("key1", "value1")
    await vault.set("key2", "value2")

    const content = await readFile(testPath, "utf-8")
    const data = JSON.parse(content)

    expect(data).toEqual({
      key1: { value: "value1" },
      key2: { value: "value2" },
    })
  })

  it("stores metadata in JSON format", async () => {
    const vault = new JsonFileSecretVault({ clock: new FakeClock() }, { path: testPath })

    await vault.set("with-meta", "value", {
      metadata: { env: "prod" },
    })

    const content = await readFile(testPath, "utf-8")
    const data = JSON.parse(content)

    expect(data["with-meta"].metadata).toEqual({ env: "prod" })
  })

  it("stores expiry in JSON format", async () => {
    const vault = new JsonFileSecretVault({ clock: new FakeClock() }, { path: testPath })
    const expiresAt = new Date("2030-01-01T00:00:00Z")

    await vault.set("expiring", "value", { expiresAt })

    const content = await readFile(testPath, "utf-8")
    const data = JSON.parse(content)

    expect(data.expiring.expiresAt).toBe("2030-01-01T00:00:00.000Z")
  })

  it("returns null for expired secrets", async () => {
    const now = Date.now()
    const vault = new JsonFileSecretVault(
      { clock: new FakeClock(now) },
      { path: testPath },
    )

    const expiresAt = new Date(now - 1000)

    await vault.set("expired", "value", { expiresAt })

    const result = await vault.get("expired")
    expect(result).toBeNull()
  })

  it("removes expired secrets from file on access", async () => {
    const now = Date.now()
    const vault = new JsonFileSecretVault(
      { clock: new FakeClock(now) },
      { path: testPath },
    )

    const expiresAt = new Date(now - 1000)

    await vault.set("expired", "value", { expiresAt })
    await vault.get("expired")

    const content = await readFile(testPath, "utf-8")
    const data = JSON.parse(content)

    expect(data.expired).toBeUndefined()
  })

  describe("createIfMissing option", () => {
    it("creates file when createIfMissing is true (default)", async () => {
      const vault = new JsonFileSecretVault(
        { clock: new FakeClock() },
        { path: testPath },
      )

      await vault.set("key", "value")

      const content = await readFile(testPath, "utf-8")
      expect(JSON.parse(content)).toHaveProperty("key")
    })

    it("throws when file missing and createIfMissing is false", async () => {
      const vault = new JsonFileSecretVault(
        { clock: new FakeClock() },
        {
          path: testPath,
          createIfMissing: false,
        },
      )

      await expect(vault.get("key")).rejects.toThrow("Secrets file not found")
    })

    it("reads existing file when createIfMissing is false", async () => {
      await writeFile(testPath, JSON.stringify({ key: { value: "existing" } }))

      const vault = new JsonFileSecretVault(
        { clock: new FakeClock() },
        {
          path: testPath,
          createIfMissing: false,
        },
      )

      const result = await vault.get("key")
      expect(result!.value).toBe("existing")
    })
  })

  describe("directory creation", () => {
    it("creates parent directories if needed", async () => {
      const nestedPath = join(testDir, "nested", "deep", "secrets.json")
      const vault = new JsonFileSecretVault(
        { clock: new FakeClock() },
        { path: nestedPath },
      )

      await vault.set("key", "value")

      const content = await readFile(nestedPath, "utf-8")
      expect(JSON.parse(content)).toHaveProperty("key")
    })
  })

  describe("concurrent access", () => {
    it("handles rapid sequential writes", async () => {
      const vault = new JsonFileSecretVault(
        { clock: new FakeClock() },
        { path: testPath },
      )

      await vault.set("key1", "value1")
      await vault.set("key2", "value2")
      await vault.set("key3", "value3")

      const keys = await vault.list()
      expect(keys).toEqual(["key1", "key2", "key3"])
    })
  })
})
