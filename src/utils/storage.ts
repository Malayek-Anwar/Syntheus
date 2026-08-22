/**
 * Extracts the storage object path from a Supabase storage URL or direct path
 * for the personal_documents bucket.
 */
export function extractPersonalStoragePath(fileUrlOrPath: string): string {
  if (!fileUrlOrPath) return ''
  const match = fileUrlOrPath.match(/\/personal_documents\/([^?]+)/)
  if (match?.[1]) {
    return decodeURIComponent(match[1])
  }
  return fileUrlOrPath
}
