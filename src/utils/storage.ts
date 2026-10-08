import type { SupabaseClient } from '@supabase/supabase-js'

export const INSTITUTIONAL_BUCKET = 'institutional-documents'
export const PERSONAL_BUCKET = 'personal-documents'
export const SIGNED_URL_TTL_SECONDS = 15 * 60

/**
 * Creates a short-lived signed URL for an institutional document.
 */
export async function getInstitutionalSignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds: number = SIGNED_URL_TTL_SECONDS
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
  expiresInSeconds: number = SIGNED_URL_TTL_SECONDS
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
