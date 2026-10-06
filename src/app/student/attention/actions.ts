'use server'

import { createClient } from '@/utils/supabase/server'
import { normalizeAudience, isAudienceVisibleToStudent } from '@/utils/audience'
import { getErrorMessage } from '@/utils/errors'

export async function markNoticeFinished(noticeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!noticeId) return { success: false, error: 'Notice ID is required' }
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase.from('notice_completions').upsert({
      user_id: user.id,
      notice_id: noticeId,
    })

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function markNoticeUnfinished(noticeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!noticeId) return { success: false, error: 'Notice ID is required' }
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase
      .from('notice_completions')
      .delete()
      .eq('user_id', user.id)
      .eq('notice_id', noticeId)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function findAttentionNotice(query: string): Promise<{
  success: boolean
  notice?: { id: string; title: string }
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) return { success: false, error: 'Not authenticated' }

    const rawDept = user.user_metadata?.department || 'CSE'
    const rawSem = user.user_metadata?.semester || 'Semester 1'
    const { target_departments, target_semesters } = normalizeAudience(rawDept, rawSem)
    const studentDept = target_departments[0] || 'CSE'
    const studentSem = target_semesters[0] || 1
    const normalizedQuery = query.trim().toLowerCase()

    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, title, deadline, priority, target_departments, target_semesters')
      .eq('is_published', true)

    if (error) return { success: false, error: error.message }

    const matches = (documents ?? []).filter((doc) =>
      isAudienceVisibleToStudent(doc, studentDept, studentSem) &&
      (Boolean(doc.deadline) || doc.priority?.toLowerCase() === 'high') &&
      doc.title.toLowerCase().includes(normalizedQuery)
    )

    if (matches.length !== 1) {
      return {
        success: false,
        error: matches.length > 1
          ? 'I found more than one matching attention item. Please use its exact title.'
          : 'I could not find a matching active attention item.',
      }
    }

    return { success: true, notice: { id: matches[0].id, title: matches[0].title } }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) }
  }
}
