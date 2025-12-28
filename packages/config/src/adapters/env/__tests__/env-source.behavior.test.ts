import { EnvSource } from "../env-source"

describe("EnvSource behavior", () => {
  it("returns all env vars when no prefix", async () => {
    const env = {
      PORT: "3000",
      HOST: "localhost",
      DEBUG: "true",
    }

    const source = new EnvSource({ env })
    const result = await source.load()

    expect(result).toEqual({
      PORT: "3000",
      HOST: "localhost",
      DEBUG: "true",
    })
  })

  it("filters and strips prefix when provided", async () => {
    const env = {
      APP_PORT: "3000",
      APP_HOST: "localhost",
      OTHER_KEY: "ignored",
      PATH: "/usr/bin",
    }

    const source = new EnvSource({ env, prefix: "APP_" })
    const result = await source.load()

    expect(result).toEqual({
      PORT: "3000",
      HOST: "localhost",
    })
  })

  it("uses injected env over process.env", async () => {
    const injected = { CUSTOM: "injected_value" }

    const source = new EnvSource({ env: injected })
    const result = await source.load()

    expect(result).toEqual({ CUSTOM: "injected_value" })
    expect(result).not.toHaveProperty("PATH")
  })
})
