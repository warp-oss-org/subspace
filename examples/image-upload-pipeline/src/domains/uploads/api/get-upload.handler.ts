import type { Context, RequestHandler } from "@subspace/server"
import type { UploadServices } from "../composition"
import { UploadId, type UploadRecord } from "../model/upload.model"

export function getUploadHandler(deps: UploadServices): RequestHandler {
  return async (c: Context) => {
    const idParam = c.req.param("id")

    if (!UploadId.is(idParam)) return c.notFound()

    const id = UploadId.parse(idParam)

    const result = await deps.uploadOrchestrator.getUpload(id)

    return result ? c.json<UploadRecord>(result) : c.notFound()
  }
}
