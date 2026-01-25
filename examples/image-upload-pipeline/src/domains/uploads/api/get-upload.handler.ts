import type { Context, RequestHandler } from "@subspace/server"
import type { UploadServices } from "../composition"
import { UploadId } from "../model/upload.model"

export function getUploadHandler(deps: UploadServices): RequestHandler {
  return async (c: Context) => {
    const id = UploadId.parse(c.req.param("id"))
    const result = await deps.metadataStore.get(id)

    return result ? c.json(result) : c.notFound()
  }
}
