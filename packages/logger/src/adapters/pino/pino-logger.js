import pino from "pino"
import { errWithCause } from "pino-std-serializers"
export class PinoLogger {
  logger
  opts
  deps
  constructor(deps = {}, opts = {}, context = {}) {
    this.opts = opts
    this.deps = deps
    this.logger = this.init(context)
  }
  init(context) {
    if (this.deps.base) return this.deps.base.child(context)
    const pinoOpts = {
      ...(this.opts.level && { level: this.opts.level }),
      serializers: { err: errWithCause },
      ...(this.opts.prettify && {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "hostname",
          },
        },
      }),
    }
    const root = this.deps.destination
      ? pino(pinoOpts, this.deps.destination)
      : pino(pinoOpts)
    return root.child(context)
  }
  toPinoMeta(meta) {
    return meta
  }
  trace(message, meta) {
    this.logger.trace(this.toPinoMeta(meta), message)
  }
  debug(message, meta) {
    this.logger.debug(this.toPinoMeta(meta), message)
  }
  info(message, meta) {
    this.logger.info(this.toPinoMeta(meta), message)
  }
  warn(message, meta) {
    this.logger.warn(this.toPinoMeta(meta), message)
  }
  error(message, meta) {
    this.logger.error(this.toPinoMeta(meta), message)
  }
  fatal(message, meta) {
    this.logger.fatal(this.toPinoMeta(meta), message)
  }
  child(context) {
    return new PinoLogger({ base: this.logger }, this.opts, context)
  }
}
export function createPinoLogger(deps = {}, opts = {}, context = {}) {
  return new PinoLogger(deps, opts, context)
}
//# sourceMappingURL=pino-logger.js.map
