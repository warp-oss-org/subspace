import type { Context, RequestHandler } from "@subspace/server"
import type { UploadServices } from "../composition"
import { JobId } from "../model/job.model"
import { UploadId } from "../model/upload.model"

export function completeUploadHandler(deps: UploadServices): RequestHandler {
  return async (c: Context) => {
    const id = UploadId.parse(c.req.param("id"))
    const upload = await deps.metadataStore.get(id)

    if (!upload) return c.notFound()

    const now = deps.clock.now()
    await deps.jobStore.enqueue({
      id: JobId.generate(),
      uploadId: id,
      status: "pending",
      attempt: 0,
      runAt: now,
      createdAt: now,
      updatedAt: now,
    })

    return c.json({ status: "queued" }, 202)
  }
}
