const UPLOAD_METADATA_NS = "uploads:metadata"
const UPLOAD_JOBS_NS = "uploads:jobs"
const UPLOAD_JOBS_INDEX_NS = "uploads:jobs:index"

const UPLOAD_STAGING_NS = "uploads"
const UPLOAD_FINAL_NS = "objects"

export function uploadMetadataKeyspace(prefix: string): string {
  return `${prefix}:${UPLOAD_METADATA_NS}`
}

export function uploadJobsKeyspace(prefix: string): string {
  return `${prefix}:${UPLOAD_JOBS_NS}`
}

export function uploadJobsIndexKeyspace(prefix: string): string {
  return `${prefix}:${UPLOAD_JOBS_INDEX_NS}`
}

export function uploadStagingPrefix(prefix: string): string {
  return `${prefix}/${UPLOAD_STAGING_NS}`
}

export function uploadFinalPrefix(prefix: string): string {
  return `${prefix}/${UPLOAD_FINAL_NS}`
}
