export type SuggestionPrompt = {
  label: string
  query: string
  description?: string
}

export type SuggestionContext = {
  department?: string
  semester?: number | string
  personalDocuments?: Array<{ title: string }>
  recentNotices?: Array<{ title: string; category?: string | null; deadline?: string | null }>
}

export function generatePersonalizedSuggestions(ctx?: SuggestionContext): SuggestionPrompt[] {
  const dept = ctx?.department || 'CSE'
  const sem = ctx?.semester
    ? (typeof ctx.semester === 'string' && ctx.semester.toLowerCase().includes('semester')
        ? ctx.semester.replace(/semester\s*/i, 'Sem ')
        : `Sem ${ctx.semester}`)
    : 'Sem 1'

  const suggestions: SuggestionPrompt[] = []

  // 1. If student has uploaded personal documents, prioritize questions about their private files!
  if (ctx?.personalDocuments && ctx.personalDocuments.length > 0) {
    for (const doc of ctx.personalDocuments.slice(0, 2)) {
      const cleanTitle = doc.title.replace(/\.pdf$/i, '').trim()
      const shortTitle = cleanTitle.length > 18 ? cleanTitle.slice(0, 16) + '...' : cleanTitle
      suggestions.push({
        label: `📄 ${shortTitle}`,
        query: `What are the important details and clauses in my uploaded document "${cleanTitle}"?`,
        description: `Query your private file: ${shortTitle}`,
      })
    }
  }

  // 2. If there are active notices with deadlines for this student
  if (ctx?.recentNotices && ctx.recentNotices.length > 0) {
    const noticeWithDeadline = ctx.recentNotices.find((n) => n.deadline)
    if (noticeWithDeadline) {
      const cleanNotice = noticeWithDeadline.title.replace(/\.pdf$/i, '').trim()
      const shortNotice = cleanNotice.length > 18 ? cleanNotice.slice(0, 16) + '...' : cleanNotice
      suggestions.push({
        label: `⏳ ${shortNotice}`,
        query: `What is the deadline and requirements for ${cleanNotice}?`,
        description: `Check upcoming deadline info`,
      })
    }
  }

  // 3. Department & Semester specific academic schedule / lab suggestions
  suggestions.push({
    label: `🔬 ${dept} ${sem} Labs`,
    query: `Show ${dept} ${sem} lab schedule and practical timetable`,
    description: `${dept} lab practicals & timings`,
  })

  suggestions.push({
    label: `📅 ${dept} ${sem} Exams`,
    query: `When are the mid-sem and end-sem exams for ${dept} ${sem}?`,
    description: `Exam schedule & syllabus updates`,
  })

  // 4. Fill in additional department / institutional prompts if needed
  if (suggestions.length < 4) {
    suggestions.push({
      label: `💳 ${sem} Fee Dues`,
      query: `Are there any fee payment or registration deadlines for ${sem}?`,
      description: `Tuition dues and registration`,
    })
  }

  if (suggestions.length < 4) {
    suggestions.push({
      label: `📢 ${dept} Circulars`,
      query: `What are the latest announcements and circulars for ${dept} students?`,
      description: `Official department notices`,
    })
  }

  // Deduplicate by query and limit to 4
  const seenQueries = new Set<string>()
  const finalPrompts: SuggestionPrompt[] = []
  for (const s of suggestions) {
    if (!seenQueries.has(s.query)) {
      seenQueries.add(s.query)
      finalPrompts.push(s)
    }
    if (finalPrompts.length === 4) break
  }

  return finalPrompts
}

export const SUGGESTED_PROMPTS: SuggestionPrompt[] = generatePersonalizedSuggestions()
