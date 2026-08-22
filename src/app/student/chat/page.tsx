import { createClient } from '@/utils/supabase/server'
import { StudentChat } from '@/components/StudentChat'
import { normalizeAudience, isAudienceVisibleToStudent } from '@/utils/audience'
import { generatePersonalizedSuggestions, type SuggestionPrompt } from '@/utils/constants'
import type { UIMessage } from 'ai'

export default async function StudentChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let initialMessages: UIMessage[] = []
  let suggestions: SuggestionPrompt[] = []

  if (user) {
    const rawDept = user?.user_metadata?.department || 'CSE'
    const rawSem = user?.user_metadata?.semester || 'Semester 1'

    const { target_departments: studentDepts, target_semesters: studentSems } = normalizeAudience(rawDept, rawSem)
    const studentDept = studentDepts[0] || 'CSE'
    const studentSem = studentSems[0] || 1

    // Fetch conversation history, student's personal documents, and recent notices concurrently
    const [messagesRes, personalDocsRes, noticesRes] = await Promise.all([
      supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('personal_documents')
        .select('id, title, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('documents')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    if (messagesRes.data) {
      initialMessages = messagesRes.data.map((msg) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant' | 'system',
        parts: [{ type: 'text', text: msg.content }],
      }))
    }

    const visibleNotices = (noticesRes.data ?? []).filter((doc) =>
      isAudienceVisibleToStudent(doc, studentDept, studentSem)
    )

    suggestions = generatePersonalizedSuggestions({
      department: studentDept,
      semester: studentSem,
      personalDocuments: personalDocsRes.data ?? [],
      recentNotices: visibleNotices,
    })
  } else {
    suggestions = generatePersonalizedSuggestions()
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-gray-50 p-2 sm:p-4 md:p-6 overflow-hidden">
      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col min-h-0">
        <StudentChat initialMessages={initialMessages} suggestions={suggestions} />
      </div>
    </div>
  )
}
