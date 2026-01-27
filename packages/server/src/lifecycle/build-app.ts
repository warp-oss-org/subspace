import { Hono } from "hono"
import type { ErrorHandler } from "../errors/create-error-handler"
import { registerHealthRoutes } from "../routes/health"
import type { Application, Middleware } from "../server"
import type { ResolvedServerOptions } from "../server/server-options"

interface CreateAppContext {
  isReady: () => boolean
  createApp: () => Application
  createErrorHandler: () => ErrorHandler
  options: ResolvedServerOptions
  defaultMiddleware: Middleware[]
}

export function buildApp(ctx: CreateAppContext): Application {
  const { options, isReady, createApp } = ctx

  const app = createApp ? createApp() : new Hono()

  if (options.health.enabled) {
    registerHealthRoutes(app, options.health, isReady)
  }

  applyMiddleware(app, ctx.defaultMiddleware)

  applyMiddleware(app, options.middleware.pre)
  options.routes(app)
  applyMiddleware(app, options.middleware.post)

  applyErrorHandler(app, ctx.createErrorHandler)

  return app
}

export type BuildAppFn = typeof buildApp

function applyErrorHandler(
  app: Application,
  createErrorHandler: () => ErrorHandler,
): void {
  app.onError(createErrorHandler())
}

function applyMiddleware(app: Application, middleware: Middleware[] | undefined): void {
  if (!middleware?.length) return

  for (const mw of middleware) app.use("*", mw)
}
