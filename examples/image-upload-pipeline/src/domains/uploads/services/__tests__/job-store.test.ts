describe("JobStore", () => {
  describe("get", () => {
    it.todo("returns null when job does not exist")
    it.todo("returns the job when it exists")
  })

  describe("enqueue", () => {
    it.todo("persists a new job that can be retrieved")
    it.todo("overwrites an existing job with the same id")
    it.todo("adds the job id to the index")
  })

  describe("markCompleted", () => {
    it.todo("sets status to completed and updates timestamp")
    it.todo("removes the job from the index")
    it.todo("does nothing when job does not exist")
    it.todo("preserves other job fields")
  })

  describe("markFailed", () => {
    it.todo("sets status to failed with reason and updates timestamp")
    it.todo("removes the job from the index")
    it.todo("does nothing when job does not exist")
    it.todo("preserves other job fields")
  })

  describe("reschedule", () => {
    it.todo("sets status back to pending")
    it.todo("increments the attempt counter")
    it.todo("updates runAt to the provided next run time")
    it.todo("sets lastError when provided")
    it.todo("does not set lastError when not provided")
    it.todo("does nothing when job does not exist")
  })

  describe("listDue", () => {
    it.todo("returns empty array when no jobs exist")
    it.todo("returns pending jobs where runAt <= now")
    it.todo("excludes pending jobs where runAt > now")
    it.todo("returns running jobs with expired lease (runAt <= now)")
    it.todo("excludes running jobs with active lease (runAt > now)")
    it.todo("excludes completed jobs")
    it.todo("excludes failed jobs")
    it.todo("respects the limit parameter")
    it.todo("handles index entries pointing to deleted jobs gracefully")

    describe("ordering", () => {
      it.todo("returns jobs sorted by runAt ascending")
      it.todo("jobs with earlier runAt come before jobs with later runAt")
      it.todo("when limit is applied, returns the earliest jobs first")
    })
  })

  describe("tryClaim", () => {
    it.todo("returns null when job does not exist")
    it.todo("claims a pending job and returns the updated job")
    it.todo("sets status to running when claimed")
    it.todo("sets runAt to now + leaseDuration when claimed")
    it.todo("updates the updatedAt timestamp when claimed")
    it.todo("reclaims a running job with expired lease")
    it.todo("returns null for running job with active lease")
    it.todo("returns null for completed job")
    it.todo("returns null for failed job")

    describe("concurrency", () => {
      it.todo("only one caller wins when two attempt to claim simultaneously")
      it.todo("losing caller receives null")
    })
  })

  describe("index consistency", () => {
    it.todo("index may contain ids for jobs that no longer exist")
    it.todo("jobs may exist that are not in the index (orphaned)")
  })
})
