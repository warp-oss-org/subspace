import { SystemClock } from "@subspace-kit/clock"
import type { Logger } from "@subspace-kit/logger"
import { createPinoLogger } from "@subspace-kit/logger/pino"
import { createRetryExecutor, type IRetryExecutor } from "@subspace-kit/retry"
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
