import type { Context, RequestHandler } from "@subspace/server"
import type { UploadServices } from "../composition"
import type { CreateUploadResult } from "../model/upload.model"
import { createUploadRequestSchema } from "./upload.api.schema"

export function createUploadHandler(deps: UploadServices): RequestHandler {
  return async (c: Context) => {
    const body = await c.req.json()
    const fileDetails = createUploadRequestSchema.parse(body)

    const result = await deps.uploadOrchestrator.createUpload({
      filename: fileDetails.filename,
      ...(fileDetails.contentType && { contentType: fileDetails.contentType }),
      ...(fileDetails.expectedSizeBytes && {
        expectedSizeBytes: fileDetails.expectedSizeBytes,
      }),
    })

    return c.json<CreateUploadResult>(result, 201)
  }
}
