import {
  DescribeParametersCommand,
  GetParameterCommand,
  type SSMClient,
} from "@aws-sdk/client-ssm"
import { createSsmTestClient } from "../../../tests/utils/create-aws-secrets-client"
import { deleteAllSecrets } from "../../../tests/utils/delete-all-secrets"
import { AwsSsmVault } from "../aws-ssm-vault"

describe("AwsSsmVault (integration)", () => {
  let client: SSMClient
  let keyspacePrefix: string

  beforeAll(() => {
    const testClient = createSsmTestClient()
    client = testClient.client
    keyspacePrefix = testClient.keyspacePrefix
  })

  const cleanup = async () => {
    await deleteAllSecrets(new AwsSsmVault({ client }, { prefix: keyspacePrefix }))
  }

  afterEach(async () => {
    await cleanup()
  })

  afterAll(async () => {
    await cleanup()
  })

  // !! TODO: re-assess behavior/contract/integration test split
  const prefixCandidates = (prefix: string): string[] => {
    const p = prefix.startsWith("/") ? prefix : `/${prefix}`
    return [prefix, p].filter((v, i, a) => a.indexOf(v) === i)
  }

  const findRawParameterNameForKey = async (key: string): Promise<string | null> => {
    for (const p of prefixCandidates(keyspacePrefix)) {
      const res = await client.send(
        new DescribeParametersCommand({
          ParameterFilters: [{ Key: "Name", Option: "BeginsWith", Values: [p] }],
          MaxResults: 50,
        }),
      )

      const names =
        res.Parameters?.map((x) => x.Name).filter((n): n is string => Boolean(n)) ?? []

      const expectedA = `${p}${key}`
      const expectedB = p.endsWith("/") ? `${p}${key}` : `${p}/${key}`

      const hit = names.find((n) => n === expectedA || n === expectedB)
      if (hit) return hit
    }

    return null
  }

  describe("prefix wiring", () => {
    it("persists keys under prefixed parameter names in SSM", async () => {
      const vault = new AwsSsmVault({ client }, { prefix: keyspacePrefix })

      const key = "alpha"
      await vault.set(key, "value")

      const rawName = await findRawParameterNameForKey(key)
      expect(rawName).not.toBeNull()

      // sanity: provider name includes prefix and ends with key
      expect(rawName!.endsWith(key) || rawName!.endsWith(`/${key}`)).toBe(true)
    })

    it("does not double-prefix keys", async () => {
      const vault = new AwsSsmVault({ client }, { prefix: keyspacePrefix })

      const key = "beta"
      await vault.set(key, "value")

      const rawName = await findRawParameterNameForKey(key)
      expect(rawName).not.toBeNull()

      const normalized = keyspacePrefix.replace(/^\//, "")
      expect(rawName!).not.toContain(`${normalized}${normalized}`)
    })
  })

  describe("provider timestamp wiring", () => {
    it("updatedAt reflects SSM LastModifiedDate (sanity)", async () => {
      const vault = new AwsSsmVault({ client }, { prefix: keyspacePrefix })

      const key = "timestamped"
      await vault.set(key, "value")

      const fromVault = await vault.get(key)
      expect(fromVault).not.toBeNull()
      expect(fromVault!.updatedAt).toBeInstanceOf(Date)

      const rawName = await findRawParameterNameForKey(key)
      expect(rawName).not.toBeNull()

      const raw = await client.send(
        new GetParameterCommand({
          Name: rawName!,
          WithDecryption: true,
        }),
      )

      const providerDate = raw.Parameter?.LastModifiedDate
      expect(providerDate).toBeInstanceOf(Date)

      expect(
        Math.abs(providerDate!.getTime() - fromVault!.updatedAt!.getTime()),
      ).toBeLessThan(60_000)
    })
  })
})
