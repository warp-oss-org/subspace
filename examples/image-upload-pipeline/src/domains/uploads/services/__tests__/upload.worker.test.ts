describe("UploadFinalizationWorker", () => {
  describe("start", () => {
    it.todo("sets worker to running state")
    it.todo("begins polling for jobs")
    it.todo("can be called after stop to restart")
  })

  describe("stop", () => {
    it.todo("sets worker to not running state")
    it.todo("stops claiming new jobs")
    it.todo("waits for in-flight jobs to complete before resolving")
    it.todo("resolves immediately if no jobs in flight")
  })

  describe("job polling", () => {
    it.todo("fetches up to concurrency limit jobs")
    it.todo("respects available capacity (concurrency - inFlight)")
    it.todo("applies idle backoff when no jobs available")
    it.todo("resets idle backoff when jobs found")
    it.todo("continues polling after transient errors")
  })

  describe("job claiming", () => {
    it.todo("claims job before processing")
    it.todo("skips job if claim fails (another worker claimed it)")
    it.todo("stops claiming when stop signaled")
    it.todo("stops claiming when concurrency limit reached")
  })

  describe("job preparation", () => {
    it.todo("fetches upload metadata after claiming job")
    it.todo("skips job if upload not found")
    it.todo("skips job if upload status is not queued")
    it.todo("fails job and upload if filename is missing")
    it.todo("transitions upload to processing status")

    describe("race conditions", () => {
      it.todo("handles upload already finalized by another worker")
      it.todo("handles upload already failed by another worker")
    })
  })

  describe("finalization", () => {
    it.todo("fetches staging object")
    it.todo("throws if staging object not found")
    it.todo("processes image through image processor")
    it.todo("uploads all variants to final location")
    it.todo("marks upload as finalized with variants")
    it.todo("records actual size from staging object")
  })

  describe("variant filenames", () => {
    it.todo("original: photo.jpg -> photo.jpg")
    it.todo("thumbnail: photo.jpg -> photo-thumbnail.jpg")
    it.todo("preview: photo.jpg -> photo-preview.jpg")
    it.todo("no extension: photo -> photo-thumbnail")
    it.todo("multiple dots: photo.2024.jpg -> photo.2024-thumbnail.jpg")
  })

  describe("job completion", () => {
    it.todo("marks job completed on success")
  })

  describe("job failure handling", () => {
    describe("retryable errors", () => {
      it.todo("reschedules job if error is retryable")
      it.todo("increments attempt count on reschedule")
      it.todo("marks job failed if max attempts exhausted")
    })

    describe("permanent failures", () => {
      it.todo("marks job failed if error not retryable")
      it.todo("marks upload failed alongside job")
      it.todo("records failure reason")
    })

    describe("failure handling errors", () => {
      it.todo("swallows errors when marking job failed")
      it.todo("swallows errors when rescheduling job")
    })
  })

  describe("concurrency", () => {
    it.todo("processes jobs concurrently up to limit")
    it.todo("increments in-flight count when job starts")
    it.todo("decrements in-flight count when job completes")
    it.todo("decrements in-flight count when job fails")
  })

  describe("graceful shutdown", () => {
    it.todo("stop() waits for in-flight jobs")
    it.todo("does not start new jobs after stop called")
    it.todo("completes in-flight jobs even after stop")
  })

  describe("error recovery", () => {
    it.todo("survives job store errors during polling")
    it.todo("survives metadata store errors during preparation")
    it.todo("survives object store errors during finalization")
    it.todo("survives image processor errors")
  })
})

describe("UploadWorkerError", () => {
  describe("uploadNotFound", () => {
    it.todo("has code upload_not_found")
    it.todo("is not retryable")
  })

  describe("invalidUploadState", () => {
    it.todo("has code invalid_upload_state")
    it.todo("is not retryable")
  })

  describe("stagingObjectMissing", () => {
    it.todo("has code staging_object_missing")
    it.todo("is retryable")
  })

  describe("missingFilename", () => {
    it.todo("has code missing_filename")
    it.todo("is not retryable")
  })
})
