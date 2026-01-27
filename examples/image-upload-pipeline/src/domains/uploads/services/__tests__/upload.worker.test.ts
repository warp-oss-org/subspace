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
    it.todo("interrupts idle backoff sleep")
  })

  describe("job polling", () => {
    it.todo("fetches up to concurrency limit jobs")
    it.todo("respects available capacity (concurrency - inFlight)")
    it.todo("waits capacityPollMs when at max concurrency")
    it.todo("applies idle backoff when no jobs available")
    it.todo("resets idle backoff counter when jobs are found")
    it.todo("continues polling after transient errors")
  })

  describe("job claiming", () => {
    it.todo("attempts to claim each candidate job")
    it.todo("skips job if claim fails (another worker claimed it)")
    it.todo("stops claiming when stop is signaled")
    it.todo("stops claiming when concurrency limit reached")
    it.todo("uses CAS to ensure only one worker claims a job")
  })

  describe("job preparation", () => {
    it.todo("fetches upload metadata after claiming job")
    it.todo("skips job if upload not found")
    it.todo("skips job if upload status is not queued")
    it.todo("fails job and upload if filename is missing")
    it.todo("transitions upload to processing status")
    it.todo("skips job if processing transition fails")
    it.todo("succeeds if upload already in processing state with same filename")

    describe("race conditions", () => {
      it.todo("gracefully handles upload already finalized by another worker")
      it.todo("gracefully handles upload already failed by another worker")
      it.todo("does not treat concurrent completion as an error")
    })
  })

  describe("job processing", () => {
    it.todo("increments in-flight count when job starts")
    it.todo("decrements in-flight count when job completes")
    it.todo("decrements in-flight count when job fails")
    it.todo("processes jobs concurrently up to concurrency limit")
    it.todo("does not block polling while processing")
  })

  describe("upload finalization", () => {
    it.todo("fetches staging object for the upload")
    it.todo("throws if staging object not found")
    it.todo("throws if upload not found during finalization")
    it.todo("throws if upload status changed from processing")
    it.todo("passes staging object to image processor")
    it.todo("uploads all processed variants to final location")
    it.todo("marks upload as finalized with original variant location")
    it.todo("records actual size from staging object metadata")
    it.todo("records all promoted variants in metadata")
  })

  describe("variant upload", () => {
    it.todo("uploads all variants from image processor")
    it.todo("uploads variants concurrently")
    it.todo("uses original filename for original variant")
    it.todo("appends variant suffix before extension for other variants")
    it.todo("handles filenames without extension")
    it.todo("preserves content type from image processor")
  })

  describe("variant filename generation", () => {
    it.todo("original variant: photo.jpg -> photo.jpg")
    it.todo("thumbnail variant: photo.jpg -> photo-thumbnail.jpg")
    it.todo("preview variant: photo.jpg -> photo-preview.jpg")
    it.todo("no extension: photo -> photo-thumbnail")
    it.todo("multiple dots: photo.2024.jpg -> photo.2024-thumbnail.jpg")
  })

  describe("job completion", () => {
    it.todo("marks job as completed on success")
    it.todo("uses IO retry for completion")
  })

  describe("job failure handling", () => {
    describe("retryable errors", () => {
      it.todo("reschedules job if error is retryable and attempts not exhausted")
      it.todo("calculates next run time using jobRetryDelay policy")
      it.todo("increments attempt count on reschedule")
      it.todo("records error reason on reschedule")
    })

    describe("permanent failures", () => {
      it.todo("marks job failed if error is not retryable")
      it.todo("marks job failed if max attempts exhausted")
      it.todo("marks upload as failed alongside job")
      it.todo("records failure reason")
    })

    describe("best-effort failure handling", () => {
      it.todo("swallows errors when marking job failed")
      it.todo("swallows errors when rescheduling job")
      it.todo("relies on lease expiry for recovery if failure handling fails")
    })
  })

  describe("IO retry", () => {
    it.todo("wraps job store operations with retry")
    it.todo("wraps metadata store operations with retry")
    it.todo("wraps object store operations with retry")
    it.todo("uses configured ioRetryConfig")
  })

  describe("concurrency control", () => {
    it.todo("never exceeds configured concurrency limit")
    it.todo("processes new jobs as in-flight jobs complete")
    it.todo("handles rapid job completion correctly")
    it.todo("handles slow jobs without blocking faster ones")
  })

  describe("graceful shutdown", () => {
    it.todo("stop() waits for all in-flight jobs")
    it.todo("polls at drainPollMs interval while waiting")
    it.todo("does not start new jobs after stop called")
    it.todo("completes in-flight jobs even after stop")
  })

  describe("error recovery", () => {
    it.todo("survives job store errors during polling")
    it.todo("survives metadata store errors during preparation")
    it.todo("survives object store errors during finalization")
    it.todo("survives image processor errors")
    it.todo("applies idle backoff after unhandled errors in run loop")
  })

  describe("clock usage", () => {
    it.todo("uses injected clock for current time")
    it.todo("uses injected clock for sleep")
    it.todo("timestamps are consistent within a single operation")
  })
})

describe("UploadWorkerError", () => {
  describe("uploadNotFound", () => {
    it.todo("has code upload_not_found")
    it.todo("is not retryable")
    it.todo("includes uploadId in context")
  })

  describe("invalidUploadState", () => {
    it.todo("has code invalid_upload_state")
    it.todo("is not retryable")
    it.todo("includes uploadId and status in context")
  })

  describe("stagingObjectMissing", () => {
    it.todo("has code staging_object_missing")
    it.todo("is retryable")
    it.todo("includes uploadId and filename in context")
  })

  describe("finalizationFailed", () => {
    it.todo("has code finalization_failed")
    it.todo("is not retryable")
    it.todo("includes uploadId and result kind in context")
  })

  describe("missingFilename", () => {
    it.todo("has code missing_filename")
    it.todo("is not retryable")
    it.todo("includes uploadId in context")
  })
})
