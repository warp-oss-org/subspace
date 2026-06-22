import type { Logger } from "@subspace-kit/logger"

export type ServerContextVariables = {
  clientIp: string
  remoteIp: string
  requestId: string
  logger: Logger
}

declare module "hono" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ContextVariableMap extends ServerContextVariables {}
}
