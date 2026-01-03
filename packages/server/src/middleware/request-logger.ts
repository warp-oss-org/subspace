import type { Logger } from "@subspace/logger"
import type { Middleware } from "../create-server"
import { isNonEmptyString } from "./utils/is-non-empty-string"

export function requestLoggerMiddleware(baseLogger: Logger): Middleware {
  return async (c, next) => {
    if (!c.get("logger")) {
      const requestId = c.get("requestId")
      const bindings = isNonEmptyString(requestId) ? { requestId } : {}

      const logger = baseLogger.child(bindings)

      c.set("logger", logger)
    }

    await next()
  }
}
