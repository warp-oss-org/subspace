import { z } from "zod/mini"

export const createUploadRequestSchema = z.object({
  filename: z
    .string()
    .check(
      z.minLength(1, { error: "Filename cannot be empty" }),
      z.maxLength(255, { error: "Filename cannot exceed 255 characters" }),
    ),
  contentType: z.optional(
    z.enum(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"], {
      error: "Unsupported content type",
    }),
  ),
  expectedSizeBytes: z.optional(
    z.number().check(z.gt(0, { error: "Expected file size must greater than 0KB" })),
  ),
})

export type CreateUploadRequest = z.infer<typeof createUploadRequestSchema>
