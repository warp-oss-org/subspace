# Image Upload Pipeline

A presigned-URL upload flow with async image processing. Demonstrates coordinating S3, Redis, and background workers using Subspace primitives.

## What It Does

1. Client requests upload → API returns presigned S3 URL
2. Client uploads directly to S3 staging bucket
3. Client signals completion → API queues processing job
4. Worker claims job, generates thumbnail/preview variants, writes to final prefix
5. Client polls for status until finalized

## Key Patterns

**Presigned uploads** - Clients upload directly to S3, avoiding proxying large files through the API server.

**CAS-based job claiming** - Workers use compare-and-swap on job state to prevent duplicate processing across instances.

**State machine metadata** - Upload records transition through `awaiting_upload → queued → processing → finalized | failed` with guarded transitions.

**Lease-based recovery** - Running jobs have a lease expiry; if a worker crashes, another can reclaim the job after timeout.

## Project Structure

```
src/
  app/
    routes/      # Route registration (/api/v1/uploads)
    services/    # Core + infra composition
  domains/
    uploads/
      model/     # Types: upload states, job states, storage locations
      services/  # UploadOrchestrator, JobStore, MetadataStore, Worker
  server/        # Server build/run entrypoints
  bin/server.ts  # Runtime entrypoint
```

## Running

```bash
# Start Redis + LocalStack
pnpm --filter @subspace/image-upload-pipeline dev:up

# Create the S3 bucket expected by .env.development
aws --endpoint-url http://localhost:4570 s3 mb s3://image-upload-pipeline-dev

# Run API + worker
pnpm --filter @subspace/image-upload-pipeline dev

# In another terminal - create an upload
curl -X POST http://localhost:4663/api/v1/uploads \
  -H "Content-Type: application/json" \
  -d '{"filename": "photo.jpg", "contentType": "image/jpeg"}'
```

## Testing

```bash
pnpm --filter @subspace/image-upload-pipeline test:up
pnpm --filter @subspace/image-upload-pipeline test
pnpm --filter @subspace/image-upload-pipeline test:down
```

## Packages Used

| Package | Purpose |
|---------|---------|
| `@subspace/server` | Hono-based HTTP with typed error handling |
| `@subspace/kv` | Redis KV with CAS operations for metadata/jobs |
| `@subspace/storage` | S3 client wrapper for staging/final buckets |
| `@subspace/retry` | IO retry with backoff for transient failures |
| `@subspace/clock` | Injectable time for testing worker timing |
