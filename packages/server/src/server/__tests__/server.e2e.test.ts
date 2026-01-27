import net from "node:net"
import { SystemClock } from "@subspace/clock"
import { NullLogger } from "../../../../logger/src/adapters/null/null-logger"
import type { ServerHandle } from "../../lifecycle/create-stopper"
import type { ServerDependencies, ServerOptions } from ".."
import { type Context, createServer } from "../"

export async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.on("error", reject)
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address()
      if (!addr || typeof addr === "string") return reject(new Error("bad addr"))
      const port = addr.port
      srv.close(() => resolve(port))
    })
  })
}

describe("server (e2e smoke)", () => {
  let server: ServerHandle | undefined
  let baseUrl: string

  beforeAll(async () => {
    const logger = new NullLogger()
    const clock = new SystemClock()

    const deps: ServerDependencies = {
      logger,
      clock,
    }

    const port = await getFreePort()

    const options: ServerOptions = {
      host: "127.0.0.1",
      port,

      startupTimeoutMs: 10_000,
      shutdownTimeoutMs: 10_000,

      errorHandling: { kind: "mappings", config: { mappings: {} } },

      health: { enabled: true },
      requestId: { enabled: true },
      requestLogging: { enabled: true },
      clientIp: { enabled: true },

      middleware: { pre: [], post: [] },

      routes: (app) => {
        app.get("/__test", (c: Context) => c.json({ ok: true }))
      },
    }

    server = await createServer(deps, options).setupProcessHandlers().start()

    if (!server) throw new Error("server did not start")

    baseUrl = `http://${server.address.host}:${server.address.port}`
  })

  afterAll(async () => {
    if (server) {
      await server.stop()
      server = undefined
    }
  })

  describe("startup + routing", () => {
    it("serves /health and /ready", async () => {
      const healthRes = await fetch(`${baseUrl}/health`)
      const readyRes = await fetch(`${baseUrl}/ready`)

      expect(healthRes.status).toBe(200)
      expect(readyRes.status).toBe(200)

      await expect(readyRes.json()).resolves.toStrictEqual({ ok: true })
      await expect(healthRes.json()).resolves.toStrictEqual({ ok: true })
    })

    it("exposes user-defined routes")
  })

  describe("shutdown behavior", () => {
    it("stop is idempotent (multiple sequential stop calls)", async () => {
      if (!server) throw new Error("server not started")

      const first = await server.stop()
      const second = await server.stop()

      expect(second).toStrictEqual(first)
      expect(first).toStrictEqual(
        expect.objectContaining({
          ok: expect.any(Boolean),
          failures: expect.any(Array),
          timedOut: expect.any(Boolean),
        }),
      )
    })

    it("stop deduplicates concurrent calls", async () => {
      if (!server) throw new Error("server not started")

      const [a, b] = await Promise.all([server.stop(), server.stop()])

      expect(b).toStrictEqual(a)
      expect(a).toStrictEqual(
        expect.objectContaining({
          ok: expect.any(Boolean),
          failures: expect.any(Array),
          timedOut: expect.any(Boolean),
        }),
      )
    })
  })
})
