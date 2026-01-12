export async function deleteAllSecrets(vault: {
  list: () => Promise<string[]>
  delete: (key: string) => Promise<void>
}) {
  try {
    const keys = await vault.list()
    for (const key of keys) await vault.delete(key)
  } catch {}
}
