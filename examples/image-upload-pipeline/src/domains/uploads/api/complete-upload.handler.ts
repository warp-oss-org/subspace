import type { Context, RequestHandler } from "@subspace/server"
import type { UploadServices } from "../composition"
import type { CompleteUploadResult } from "../model/upload.model"
import { UploadId } from "../model/upload.model"

function toResponse(
  c: Context,
  result: CompleteUploadResult,
): Response | Promise<Response> {
  switch (result.kind) {
    case "queued":
      return c.json({ uploadId: result.uploadId, status: "queued" }, 202)

    case "already_queued":
      return c.json({ uploadId: result.uploadId, status: "queued" }, 200)

    case "finalized":
      return c.json({ uploadId: result.uploadId, status: "finalized" }, 200)

    case "failed":
      return c.json({ error: result.reason }, 409)

    case "not_found":
      return c.notFound()
  }
}

export function completeUploadHandler(deps: UploadServices): RequestHandler {
  return async (c: Context) => {
    const id = UploadId.parse(c.req.param("id"))
    const result = await deps.uploadOrchestrator.completeUpload(id)

    return toResponse(c, result)
  }
}
