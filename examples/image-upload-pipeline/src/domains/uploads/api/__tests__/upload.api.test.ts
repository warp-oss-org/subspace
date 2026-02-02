import fs from "node:fs/promises"
import { uuidV4 } from "@subspace/id"
import type { Application } from "@subspace/server"
import { createTestHarness, type TestHarness } from "../../../../tests/test-harness"
import type { CreateUploadResult, UploadRecord } from "../../model/upload.model"

describe("Upload API", () => {
  let harness: TestHarness
  let app: Application

  beforeAll(async () => {
    harness = await createTestHarness()
    await harness.lifecycle.start()
    app = harness.app
  })

  afterAll(async () => {
    await harness.lifecycle.stop()
  })

  type ApiResponse<T> = {
    status: number
    body: T | null
  }

  const parseBody = async <T>(res: Response): Promise<T | null> => {
    if (res.headers.get("content-type")?.includes("application/json")) {
      return res.json() as Promise<T>
    }

    return null
  }

  const postUploads = async <T = unknown>(
    body?: Record<string, unknown>,
  ): Promise<ApiResponse<T>> => {
    const res = await app.request("/api/v1/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      ...(body && { body: JSON.stringify(body) }),
    })
    return { status: res.status, body: await parseBody<T>(res) }
  }

  const getUpload = async <T = unknown>(id: string): Promise<ApiResponse<T>> => {
    const res = await app.request(`/api/v1/uploads/${id}`, { method: "GET" })
    return { status: res.status, body: await parseBody<T>(res) }
  }

  const postComplete = async <T = unknown>(id: string): Promise<ApiResponse<T>> => {
    const res = await app.request(`/api/v1/uploads/${id}/complete`, { method: "POST" })
    return { status: res.status, body: await parseBody<T>(res) }
  }

  type CompleteUploadRecord = {
    uploadId: string
    status: string
  }

  const createUpload = async (
    filename: string,
    opts?: { contentType?: string; expectedSizeBytes?: number },
  ) => {
    const { status, body } = await postUploads<CreateUploadResult>({
      filename,
      ...opts,
    })
    expect(status).toBe(201)
    expect(body).not.toBeNull()
    return body!
  }

  const uploadFile = async (presignedUrl: string, filename: string) => {
    const testImagePath = `${__dirname}/fixtures/${filename}`
    const fileContent = await fs.readFile(testImagePath)

    await fetch(presignedUrl, {
      method: "PUT",
      body: fileContent,
      headers: { "Content-Type": "image/jpeg" },
    })
  }

  describe("POST /uploads", () => {
    describe("success", () => {
      it("returns 201 with upload ID and presigned URL", async () => {
        const { status, body } = await postUploads<CreateUploadResult>({
          filename: "photo.jpg",
        })

        expect(status).toBe(201)
        expect(body).not.toBeNull()
        expect(body!.uploadId).toBeDefined()
        expect(body!.presigned).toBeDefined()
        expect(body!.presigned.url).toContain("http")
        expect(body!.presigned.expiresAt).toBeDefined()
      })

      it("generates unique upload IDs", async () => {
        const { body: body1 } = await postUploads<CreateUploadResult>({
          filename: "a.jpg",
        })
        const { body: body2 } = await postUploads<CreateUploadResult>({
          filename: "b.jpg",
        })

        expect(body1!.uploadId).not.toBe(body2!.uploadId)
      })

      it("accepts optional content type", async () => {
        const { status } = await postUploads({
          filename: "test.jpg",
          contentType: "image/jpeg",
        })

        expect(status).toBe(201)
      })

      it("accepts optional expected size", async () => {
        const { status } = await postUploads({
          filename: "test.jpg",
          expectedSizeBytes: 1024,
        })

        expect(status).toBe(201)
      })

      it("presigned URL expires according to config", async () => {
        const { presigned } = await createUpload("test.jpg")

        const expiresAt = new Date(presigned.expiresAt)
        const now = new Date()
        const diffSeconds = (expiresAt.getTime() - now.getTime()) / 1000

        expect(diffSeconds).toBeGreaterThan(0)
        expect(diffSeconds).toBeLessThanOrEqual(
          harness.ctx.config.uploads.api.presignExpirySeconds,
        )
      })
    })

    describe("validation", () => {
      it("returns 422 when filename missing", async () => {
        const { status } = await postUploads({})

        expect(status).toBe(422)
      })

      it("returns 422 when filename is empty", async () => {
        const { status } = await postUploads({ filename: "" })

        expect(status).toBe(422)
      })

      it("returns 422 when filename exceeds max length", async () => {
        const { status } = await postUploads({ filename: "a".repeat(256) })

        expect(status).toBe(422)
      })

      it("returns 413 when expected size exceeds max upload size", async () => {
        const maxSize = harness.ctx.config.uploads.api.maxUploadSizeBytes
        const { status } = await postUploads({
          filename: "large.jpg",
          expectedSizeBytes: maxSize + 1,
        })

        expect(status).toBe(413)
      })

      it("returns 422 when expected size is negative", async () => {
        const { status } = await postUploads({
          filename: "test.jpg",
          expectedSizeBytes: -100,
        })

        expect(status).toBe(422)
      })

      it("returns 422 when expected size is zero", async () => {
        const { status } = await postUploads({
          filename: "test.jpg",
          expectedSizeBytes: 0,
        })

        expect(status).toBe(422)
      })

      it("returns 422 when content type is invalid", async () => {
        const { status } = await postUploads({
          filename: "test.jpg",
          contentType: "not-a-valid-content-type",
        })

        expect(status).toBe(422)
      })
    })
  })

  describe("GET /uploads/:id", () => {
    describe("success", () => {
      it("returns 200 with upload record", async () => {
        const { uploadId } = await createUpload("test.jpg")

        const { status, body } = await getUpload<UploadRecord>(uploadId)

        expect(status).toBe(200)
        expect(body).not.toBeNull()
        expect(body!.id).toBe(uploadId)
      })

      it("returns upload in awaiting_upload status after create", async () => {
        const { uploadId } = await createUpload("test.jpg")

        const { body } = await getUpload<UploadRecord>(uploadId)

        expect(body!.status).toBe("awaiting_upload")
      })

      it("includes filename in response", async () => {
        const { uploadId } = await createUpload("my-photo.png")

        const { body } = await getUpload<UploadRecord>(uploadId)

        expect(body!.filename).toBe("my-photo.png")
      })

      it("includes content type when provided", async () => {
        const { uploadId } = await createUpload("test.jpg", { contentType: "image/jpeg" })

        const { body } = await getUpload<UploadRecord>(uploadId)

        expect(body!.contentType).toBe("image/jpeg")
      })

      it("includes expected size when provided", async () => {
        const { uploadId } = await createUpload("test.jpg", { expectedSizeBytes: 1024 })

        const { body } = await getUpload<UploadRecord>(uploadId)

        expect(body!.expectedSizeBytes).toBe(1024)
      })

      it("returns upload in queued status after complete", async () => {
        const { uploadId, presigned } = await createUpload("test.jpg")
        await uploadFile(presigned.url, "test.jpg")
        await postComplete(uploadId)

        const { body } = await getUpload<UploadRecord>(uploadId)

        expect(body!.status).toBe("queued")
      })
    })

    describe("not found", () => {
      it("returns 404 when upload does not exist", async () => {
        const { status } = await getUpload(`upload_${uuidV4.generate()}`)

        expect(status).toBe(404)
      })

      it("returns 404 for malformed upload ID", async () => {
        const { status } = await getUpload("invalid-id")

        expect(status).toBe(404)
      })

      it("returns 404 for empty upload ID", async () => {
        const { status } = await getUpload("")

        expect(status).toBe(404)
      })
    })
  })

  describe("POST /uploads/:id/complete", () => {
    describe("success", () => {
      it("returns 202 when upload queued for processing", async () => {
        const { uploadId, presigned } = await createUpload("test.jpg")
        await uploadFile(presigned.url, "test.jpg")

        const { status } = await postComplete(uploadId)

        expect(status).toBe(202)
      })

      it("returns upload ID in response", async () => {
        const { uploadId, presigned } = await createUpload("test.jpg")
        await uploadFile(presigned.url, "test.jpg")

        const { body } = await postComplete<CompleteUploadRecord>(uploadId)

        expect(body!.uploadId).toBe(uploadId)
      })

      it("returns status queued in response", async () => {
        const { uploadId, presigned } = await createUpload("test.jpg")
        await uploadFile(presigned.url, "test.jpg")

        const { body } = await postComplete<CompleteUploadRecord>(uploadId)

        expect(body!.status).toBe("queued")
      })
    })

    describe("idempotency", () => {
      it("returns 200 when upload already queued", async () => {
        const { uploadId, presigned } = await createUpload("test.jpg")
        await uploadFile(presigned.url, "test.jpg")

        await postComplete(uploadId)
        const { status } = await postComplete(uploadId)

        expect(status).toBe(200)
      })

      it("handles concurrent complete calls", async () => {
        const { uploadId, presigned } = await createUpload("test.jpg")

        await uploadFile(presigned.url, "test.jpg")

        const results = await Promise.all([
          postComplete(uploadId),
          postComplete(uploadId),
          postComplete(uploadId),
        ])

        const statuses = results.map((r) => r.status)
        const { body } = await getUpload<UploadRecord>(uploadId)

        expect(body!.status).toBe("queued")
        expect(statuses.every((s) => [200, 202, 409].includes(s))).toBe(true)
      })
    })

    describe("not found", () => {
      it("returns 404 when upload does not exist", async () => {
        const { status } = await postComplete(`upload_${uuidV4.generate()}`)

        expect(status).toBe(404)
      })

      it("returns 404 for malformed upload ID", async () => {
        const { status } = await postComplete("invalid-id")

        expect(status).toBe(404)
      })
    })
  })
})
