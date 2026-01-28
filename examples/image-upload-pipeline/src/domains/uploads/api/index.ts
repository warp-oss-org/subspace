import { type Application, createRouter } from "@subspace/server"
import type { AppConfig } from "../../../app/config"
import type { UploadServices } from "../composition"
import { completeUploadHandler } from "./complete-upload.handler"
import { createUploadHandler } from "./create-upload.handler"
import { getUploadHandler } from "./get-upload.handler"

type UploadModuleDeps = {
  config: AppConfig
  uploads: UploadServices
}

export function createUploadsModule(deps: UploadModuleDeps) {
  return {
    name: "uploads",
    register: (api: Application) => {
      const uploads = createRouter()

      uploads.post("/", createUploadHandler(deps.uploads, deps.config))
      uploads.get("/:id", getUploadHandler(deps.uploads))
      uploads.post("/:id/complete", completeUploadHandler(deps.uploads))

      api.route("/uploads", uploads)
    },
  }
}
