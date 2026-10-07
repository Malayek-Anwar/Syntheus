import { createClient } from '@supabase/supabase-js'

/**
 * Privileged Supabase client for server-only administrative operations.
 * Never import this from client components or expose SUPABASE_SECRET_KEY.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY

  if (!secretKey) {
    throw new Error('SUPABASE_SECRET_KEY is not configured')
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
