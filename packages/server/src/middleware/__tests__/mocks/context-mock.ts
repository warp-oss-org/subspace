import type { Logger } from "@subspace/logger"
import type { Context } from "../../../create-server"

export type MockContextInput = {
  method: string
  path: string
  url?: string
  status: number
  requestId: string
  clientIp: string
  remoteIp: string
  socketRemoteAddress: string
  logger: Logger
  requestHeaders: Record<string, string>
  responseHeaders: Record<string, string>
  route?: string
}

export function mockContext(input: Partial<MockContextInput> = {}): Context {
  const vars = new Map<string, unknown>()

  if (input.requestId) vars.set("requestId", input.requestId)
  if (input.clientIp) vars.set("clientIp", input.clientIp)
  if (input.remoteIp) vars.set("remoteIp", input.remoteIp)
  if (input.logger) vars.set("logger", input.logger)
  if (input.route) vars.set("route", input.route)

  const responseHeaders = new Map<string, string>(
    Object.entries(input.responseHeaders ?? {}),
  )

  const path = input.path ?? "/"
  const url = input.url ?? `http://localhost${path}`
  const method = input.method ?? "GET"

  return {
    req: {
      method,
      path,
      url,

      header: (key: string) => input.requestHeaders?.[key.toLowerCase()],
    },

    res: {
      status: input.status ?? 200,
      headers: {
        get: (k: string) => responseHeaders.get(k),
        set: (k: string, v: string) => responseHeaders.set(k, v),
        has: (k: string) => responseHeaders.has(k),
        delete: (k: string) => responseHeaders.delete(k),
      },
    },

    get: (key: string) => vars.get(key),
    set: (key: string, value: unknown) => {
      vars.set(key, value)
    },

    json: vi.fn((body, init) => ({
      body,
      status: init?.status ?? 200,
    })),

    text: vi.fn((body, status) => ({
      body,
      status,
    })),

    env: {
      incoming: {
        socket: {
          remoteAddress: input.socketRemoteAddress ?? "",
        },
      },
    },
  } as unknown as Context
}

export type MockContext = ReturnType<typeof mockContext>
