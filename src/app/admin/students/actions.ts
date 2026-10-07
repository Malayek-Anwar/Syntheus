'use server'

import { verifyAdminAction } from '@/utils/auth'
import { getErrorMessage } from '@/utils/errors'
import { revalidatePath } from 'next/cache'
import type { Student } from '@/types/database'

export async function verifyStudentAccount(studentId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyAdminAction()
    if (!auth.authorized) {
      return { success: false, error: auth.error || 'Admin privileges required' }
    }

    const { error } = await auth.supabase
      .from('students')
      .update({
        account_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', studentId)

    if (error) throw new Error(error.message)

    revalidatePath('/admin')
    return { success: true }
  } catch (error: unknown) {
    console.error('Error verifying student account:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function suspendStudentAccount(studentId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyAdminAction()
    if (!auth.authorized) {
      return { success: false, error: auth.error || 'Admin privileges required' }
    }

    const { error } = await auth.supabase
      .from('students')
      .update({
        account_status: 'suspended',
        updated_at: new Date().toISOString(),
      })
      .eq('id', studentId)

    if (error) throw new Error(error.message)

    revalidatePath('/admin')
    return { success: true }
  } catch (error: unknown) {
    console.error('Error suspending student account:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function getStudentRegistrations(): Promise<{
  success: boolean
  students?: Student[]
  error?: string
}> {
  try {
    const auth = await verifyAdminAction()
    if (!auth.authorized) {
      return { success: false, error: auth.error || 'Admin privileges required' }
    }

    const { data, error } = await auth.supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    return { success: true, students: (data as Student[]) ?? [] }
  } catch (error: unknown) {
    console.error('Error fetching student registrations:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}
