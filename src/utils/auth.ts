import { createClient } from '@/utils/supabase/server'
import type { User, SupabaseClient } from '@supabase/supabase-js'

export type AdminAuthResult = {
  authorized: boolean
  user: User | null
  supabase: SupabaseClient
  error?: string
}

/**
 * Verifies that the current user has an authenticated session with an explicit 'admin' role.
 * Use at the top of all admin server actions and backend routes to strictly enforce authorization.
 */
export async function verifyAdminAction(): Promise<AdminAuthResult> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      authorized: false,
      user: null,
      supabase,
      error: '403 Forbidden: Authentication required'
    }
  }

  const role = user.user_metadata?.role

  if (role !== 'admin') {
    return {
      authorized: false,
      user,
      supabase,
      error: '403 Forbidden: Admin privileges required'
    }
  }

  return {
    authorized: true,
    user,
    supabase
  }
}
