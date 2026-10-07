'use server'

import { verifyStudentSession } from '@/utils/auth'
import { revalidatePath } from 'next/cache'

export async function createConversation(title: string = 'New Conversation') {
  const auth = await verifyStudentSession()
  if (!auth.authorized || !auth.student) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await auth.supabase
    .from('chat_conversations')
    .insert({
      student_id: auth.student.id,
      title,
      updated_at: new Date().toISOString(),
    })
    .select('id, title, created_at')
    .single()

  if (error) {
    console.error('Error creating conversation:', error)
    throw new Error('Failed to create conversation')
  }

  revalidatePath('/student/chat')
  return data
}

export async function listConversations() {
  const auth = await verifyStudentSession()
  if (!auth.authorized || !auth.student) {
    return []
  }

  const { data, error } = await auth.supabase
    .from('chat_conversations')
    .select('id, title, created_at, updated_at')
    .eq('student_id', auth.student.id)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error listing conversations:', error)
    return []
  }

  return data ?? []
}

export async function deleteConversation(conversationId: string) {
  const auth = await verifyStudentSession()
  if (!auth.authorized || !auth.student) {
    throw new Error('Unauthorized')
  }

  const { error } = await auth.supabase
    .from('chat_conversations')
    .delete()
    .eq('id', conversationId)
    .eq('student_id', auth.student.id)

  if (error) {
    console.error('Error deleting conversation:', error)
    throw new Error('Failed to delete conversation')
  }

  revalidatePath('/student/chat')
}

export async function clearChatHistory(conversationId?: string) {
  const auth = await verifyStudentSession()
  if (!auth.authorized || !auth.student) {
    throw new Error('Unauthorized')
  }

  if (conversationId) {
    await auth.supabase
      .from('chat_messages')
      .delete()
      .eq('conversation_id', conversationId)
  } else {
    // Delete all conversations for this student (cascades to messages and sources)
    await auth.supabase
      .from('chat_conversations')
      .delete()
      .eq('student_id', auth.student.id)
  }

  revalidatePath('/student/chat')
}
