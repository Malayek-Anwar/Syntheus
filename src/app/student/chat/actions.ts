'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function clearChatHistory() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('Unauthorized')
  }

  const { data: deletedMessages, error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('user_id', user.id)
    .select('id')

  if (error) {
    console.error('Error clearing chat history:', error)
    throw new Error('Failed to clear chat history')
  }

  const { count, error: verificationError } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (verificationError) {
    console.error('Error verifying cleared chat history:', verificationError)
    throw new Error('Failed to verify chat history was cleared')
  }

  if (count !== 0) {
    console.error(`Chat history clear left ${count ?? 'an unknown number of'} messages for user ${user.id}`)
    throw new Error('Failed to clear chat history')
  }

  if (!deletedMessages) {
    throw new Error('Failed to confirm chat history deletion')
  }

  revalidatePath('/student/chat')
}
