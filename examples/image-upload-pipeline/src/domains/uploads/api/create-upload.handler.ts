import type { Context, RequestHandler } from "@subspace/server"
import type { UploadServices } from "../composition"

export function createUploadHandler(deps: UploadServices): RequestHandler {
  return async (c: Context) => {
    const body = await c.req.json()
    const result = await deps.metadataStore.create(body)

    return c.json(result, 201)
  }
}
