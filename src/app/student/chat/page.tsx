import { createClient } from '@/utils/supabase/server'
import { StudentChat } from '@/components/StudentChat'
import type { UIMessage } from 'ai'

export default async function StudentChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let initialMessages: UIMessage[] = []

  if (user) {
    const { data: messagesData } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (messagesData) {
      initialMessages = messagesData.map((msg) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant' | 'system',
        parts: [{ type: 'text', text: msg.content }],
      }))
    }
  }

  return (
    <div className="h-full bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <StudentChat initialMessages={initialMessages} />
      </div>
    </div>
  )
}
