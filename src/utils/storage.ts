/**
 * Extracts the storage object path from a Supabase storage URL or direct path.
 * Strips query strings, hashes, and handles URL decoding safely.
 */
export function extractStoragePath(fileUrlOrPath: string, bucketName: string = 'documents'): string {
  if (!fileUrlOrPath) return ''

  // 1. Strip query parameters and fragment identifier
  const cleanUrl = fileUrlOrPath.split('?')[0].split('#')[0]

  // 2. Match standard Supabase storage bucket URLs (e.g., .../storage/v1/object/public/{bucket}/{path})
  const bucketPattern = new RegExp(`\\/${bucketName}\\/([^?#]+)`)
  const match = cleanUrl.match(bucketPattern)
  if (match?.[1]) {
    return decodeURIComponent(match[1])
  }

  // 3. Fallback: if already a direct filename or relative path
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    return decodeURIComponent(cleanUrl)
  }

  // 4. Last segment fallback
  const segments = cleanUrl.split('/').filter(Boolean)
  const lastSegment = segments.pop()
  return lastSegment ? decodeURIComponent(lastSegment) : ''
}

/**
 * Extracts the storage object path for the personal_documents bucket.
 */
export function extractPersonalStoragePath(fileUrlOrPath: string): string {
  return extractStoragePath(fileUrlOrPath, 'personal_documents')
}
