import { BaseError } from "@subspace/errors"
import type { Bytes } from "@subspace/storage"

export type UploadErrorCode = "upload_too_large"

export class UploadError extends BaseError<UploadErrorCode> {
  static uploadTooLarge(input: {
    maxUploadSizeBytes: Bytes
    expectedSizeBytes?: Bytes
  }): UploadError {
    return new UploadError(
      `Upload exceeds maximum allowed size of ${input.maxUploadSizeBytes} bytes`,
      {
        code: "upload_too_large",
        context: {
          maxUploadSizeBytes: input.maxUploadSizeBytes,
          ...(input.expectedSizeBytes !== undefined && {
            expectedSizeBytes: input.expectedSizeBytes,
          }),
        },
        isRetryable: false,
      },
    )
  }
}
