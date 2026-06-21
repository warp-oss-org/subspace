import { SystemClock } from "@subspace/clock"
import type { Logger } from "@subspace/logger"
import { createPinoLogger } from "@subspace/logger/pino"
import { createRetryExecutor, type IRetryExecutor } from "@subspace/retry"
import type { AppConfig } from "../config"

export type CoreServices = {
  logger: Logger
  clock: SystemClock
  retryExecutor: IRetryExecutor
}

export function createCoreServices(config: AppConfig): CoreServices {
  const clock = new SystemClock()

  const logger = createPinoLogger(
    {},
    {
      level: config.logging.level,
      prettify: config.logging.prettify,
    },
  )

  const retryExecutor = createRetryExecutor({ clock })

  return { clock, logger, retryExecutor }
}
