import type { Application } from "@subspace/server"
import type { UploadServices } from "../composition"
import { completeUploadHandler } from "./complete-upload.handler"
import { createUploadHandler } from "./create-upload.handler"
import { getUploadHandler } from "./get-upload.handler"

type UploadModuleDeps = {
  uploads: UploadServices
}

export function createUploadsModule(deps: UploadModuleDeps) {
  return {
    name: "uploads",
    register: (app: Application) => {
      app.post("/uploads", createUploadHandler(deps.uploads))
      app.get("/uploads/:id", getUploadHandler(deps.uploads))
      app.post("/uploads/:id/complete", completeUploadHandler(deps.uploads))
    },
  }
}
