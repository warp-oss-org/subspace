import type { Context, RequestHandler } from "@subspace/server"
import type { AppConfig } from "../../../app/config"
import type { UploadServices } from "../composition"
import { UploadError } from "../model/upload.errors"
import type { CreateUploadResult } from "../model/upload.model"
import { type CreateUploadRequest, createUploadRequestSchema } from "./upload.api.schema"

export function createUploadHandler(
  { uploadOrchestrator }: UploadServices,
  config: AppConfig,
): RequestHandler {
  return async (c: Context) => {
    const body = await c.req.json()
    const fileDetails = validateUpload(body, config)

    const result = await uploadOrchestrator.createUpload({
      filename: fileDetails.filename,
      ...(fileDetails.contentType && { contentType: fileDetails.contentType }),
      ...(fileDetails.expectedSizeBytes && {
        expectedSizeBytes: fileDetails.expectedSizeBytes,
      }),
    })

    return c.json<CreateUploadResult>(result, 201)
  }
}

function validateUpload(body: unknown, config: AppConfig): CreateUploadRequest {
  const fileDetails = createUploadRequestSchema.parse(body)

  if (isTooLarge(fileDetails.expectedSizeBytes, config.uploads.api.maxUploadSizeBytes)) {
    throw UploadError.uploadTooLarge({
      maxUploadSizeBytes: config.uploads.api.maxUploadSizeBytes,
      ...(fileDetails.expectedSizeBytes !== undefined && {
        expectedSizeBytes: fileDetails.expectedSizeBytes,
      }),
    })
  }

  return fileDetails
}

function isTooLarge(
  expectedSizeBytes: number | undefined,
  maxUploadSizeBytes: number,
): boolean {
  return expectedSizeBytes !== undefined && expectedSizeBytes > maxUploadSizeBytes
}
