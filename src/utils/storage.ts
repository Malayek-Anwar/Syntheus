import type { SupabaseClient } from '@supabase/supabase-js'

export const INSTITUTIONAL_BUCKET = 'institutional-documents'
export const PERSONAL_BUCKET = 'personal-documents'

/**
 * Extracts storage path from URL or filename.
 */
export function extractStoragePath(fileUrlOrPath: string, bucketName: string = INSTITUTIONAL_BUCKET): string {
  if (!fileUrlOrPath) return ''

  // 1. Strip query parameters and fragment identifier
  const cleanUrl = fileUrlOrPath.split('?')[0].split('#')[0]

  // 2. Match standard Supabase storage bucket URLs (e.g., .../storage/v1/object/.../{bucket}/{path})
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

export function extractPersonalStoragePath(fileUrlOrPath: string): string {
  return extractStoragePath(fileUrlOrPath, PERSONAL_BUCKET)
}

/**
 * Creates a short-lived signed URL for an institutional document.
 */
export async function getInstitutionalSignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds: number = 3600
): Promise<string | null> {
  if (!storagePath) return null
  const { data, error } = await supabase.storage
    .from(INSTITUTIONAL_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    console.error('Failed to create institutional signed URL:', error)
    return null
  }

  return data.signedUrl
}

/**
 * Creates a short-lived signed URL for a personal student document.
 */
export async function getPersonalSignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds: number = 3600
): Promise<string | null> {
  if (!storagePath) return null
  const { data, error } = await supabase.storage
    .from(PERSONAL_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    console.error('Failed to create personal signed URL:', error)
    return null
  }

  return data.signedUrl
}
