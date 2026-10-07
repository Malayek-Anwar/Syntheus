'use server'

import { createClient } from '@/utils/supabase/server'
import { verifyStudentSession, verifyAdminAction } from '@/utils/auth'
import { isDocumentVisibleToStudent } from '@/utils/audience'
import { getErrorMessage } from '@/utils/errors'

export async function markDocumentCompleted(documentId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!documentId) return { success: false, error: 'Document ID is required' }
    const auth = await verifyStudentSession()
    if (!auth.authorized || !auth.student) {
      return { success: false, error: auth.error || 'Active student authentication required' }
    }

    const supabase = auth.supabase

    // 1. Fetch document title snapshot
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('title')
      .eq('id', documentId)
      .single()

    if (docError || !doc) {
      return { success: false, error: 'Document not found' }
    }

    // 2. Upsert document completion
    const { error: upsertError } = await supabase
      .from('document_completions')
      .upsert(
        {
          student_id: auth.student.id,
          document_id: documentId,
          document_title: doc.title,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,document_id' }
      )

    if (upsertError) return { success: false, error: upsertError.message }
    return { success: true }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function unmarkDocumentCompleted(documentId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!documentId) return { success: false, error: 'Document ID is required' }
    const auth = await verifyStudentSession()
    if (!auth.authorized || !auth.student) {
      return { success: false, error: auth.error || 'Active student authentication required' }
    }

    const { error } = await auth.supabase
      .from('document_completions')
      .delete()
      .eq('student_id', auth.student.id)
      .eq('document_id', documentId)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) }
  }
}

// Aliases for compatibility
export async function markNoticeFinished(noticeId: string) {
  return markDocumentCompleted(noticeId)
}

export async function markNoticeUnfinished(noticeId: string) {
  return unmarkDocumentCompleted(noticeId)
}

/**
 * Verifies a completion record (Admin/faculty action).
 */
export async function verifyCompletion(completionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyAdminAction()
    if (!auth.authorized || !auth.user) {
      return { success: false, error: 'Admin privileges required' }
    }

    const { error } = await auth.supabase
      .from('document_completions')
      .update({
        verified_by: auth.user.id,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', completionId)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function findAttentionDocument(query: string): Promise<{
  success: boolean
  document?: { id: string; title: string }
  error?: string
}> {
  try {
    const auth = await verifyStudentSession()
    if (!auth.authorized || !auth.student) {
      return { success: false, error: 'Active student authentication required' }
    }

    const student = auth.student
    const normalizedQuery = query.trim().toLowerCase()

    const { data: documents, error } = await auth.supabase
      .from('documents')
      .select('id, title, category, tracks_completion, target_departments, target_semesters, target_sections')
      .eq('status', 'published')

    if (error) return { success: false, error: error.message }

    const matches = (documents ?? []).filter((doc) =>
      isDocumentVisibleToStudent(doc, {
        department: student.department,
        semester: student.semester,
        section: student.section,
      }) &&
      doc.tracks_completion &&
      doc.title.toLowerCase().includes(normalizedQuery)
    )

    if (matches.length !== 1) {
      return {
        success: false,
        error: matches.length > 1
          ? 'I found more than one matching item. Please specify the exact title.'
          : 'I could not find a matching active attention item.',
      }
    }

    return { success: true, document: { id: matches[0].id, title: matches[0].title } }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function findAttentionNotice(query: string) {
  const result = await findAttentionDocument(query)
  return {
    success: result.success,
    notice: result.document,
    error: result.error,
  }
}
