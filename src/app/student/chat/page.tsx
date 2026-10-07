import { verifyStudentSession } from '@/utils/auth'
import { redirect } from 'next/navigation'
import { StudentChat } from '@/components/StudentChat'
import { generatePersonalizedSuggestions, type SuggestionPrompt } from '@/utils/constants'
import type { UIMessage } from 'ai'

export default async function StudentChatPage() {
  const auth = await verifyStudentSession()
  if (!auth.authorized || !auth.student) {
    redirect('/login')
  }

  const { student, supabase } = auth
  const now = new Date()

  let initialMessages: UIMessage[] = []
  let suggestions: SuggestionPrompt[] = []

  // 1. Fetch latest conversation for this student
  const { data: latestConv } = await supabase
    .from('chat_conversations')
    .select('id')
    .eq('student_id', student.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 2. Fetch messages if conversation exists, plus personal docs and upcoming events
  const [messagesRes, personalDocsRes, eventsRes] = await Promise.all([
    latestConv
      ? supabase
          .from('chat_messages')
          .select('*')
          .eq('conversation_id', latestConv.id)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase
      .from('personal_documents')
      .select('id, title, created_at')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('academic_events')
      .select('title, event_type, starts_at')
      .gte('starts_at', now.toISOString())
      .order('starts_at', { ascending: true })
      .limit(5),
  ])

  if (messagesRes.data) {
    initialMessages = messagesRes.data.map((msg) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant' | 'system',
      parts: [{ type: 'text', text: msg.content }],
    }))
  }

  suggestions = generatePersonalizedSuggestions({
    department: student.department,
    semester: student.semester,
    personalDocuments: personalDocsRes.data ?? [],
    upcomingEvents: eventsRes.data ?? [],
  })

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-gray-50 p-2 sm:p-4 md:p-6 overflow-hidden">
      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col min-h-0">
        <StudentChat initialMessages={initialMessages} suggestions={suggestions} />
      </div>
    </div>
  )
}
