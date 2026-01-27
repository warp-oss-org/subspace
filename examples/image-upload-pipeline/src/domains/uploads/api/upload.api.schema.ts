import { z } from "zod/mini"

export const createUploadRequestSchema = z.object({
  filename: z
    .string()
    .check(
      z.length(1, { error: "Filename cannot be empty" }),
      z.length(255, { error: "Filename cannot exceed 255 characters" }),
    ),
  contentType: z.optional(z.string()),
  expectedSizeBytes: z.optional(
    z.number().check(z.gt(0, { error: "Expected file size must greater than 0KB" })),
  ),
})

export type CreateUploadRequest = z.infer<typeof createUploadRequestSchema>
