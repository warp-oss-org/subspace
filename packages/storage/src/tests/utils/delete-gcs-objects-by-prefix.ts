import type { Storage } from "@google-cloud/storage"

type PagedFilesResponse = { nextPageToken?: string }

export async function deleteGcsObjectsByPrefix(
  client: Storage,
  bucketName: string,
  prefix: string,
): Promise<void> {
  const bucket = client.bucket(bucketName)

  let pageToken: string | undefined

  do {
    const [files, , resp] = await bucket.getFiles({
      prefix,
      autoPaginate: false,
      ...(pageToken && { pageToken }),
    })

    if (files.length > 0) {
      await Promise.all(
        files.map(async (file) => {
          try {
            await file.delete()
          } catch {
            // ignore missing
          }
        }),
      )
    }

    pageToken = (resp as PagedFilesResponse | undefined)?.nextPageToken
  } while (pageToken)
}
