import { createClient } from '@/utils/supabase/server'
import { getErrorMessage } from '@/utils/errors'
import { extractPdfText } from '@/utils/pdf'
import { convertToModelMessages, isTextUIPart, streamText, type UIMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { generateEmbedding } from '@/utils/embeddings'
import { normalizeAudience } from '@/utils/audience'

const groq = createOpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
})

type CampusMatch = {
  title: string
  chunk_text: string
}

type CampusDocument = {
  title: string
  category: string | null
  target_departments: string[] | null
  target_semesters: number[] | null
  dates: string | null
  deadline: string | null
  file_url: string
}

type PersonalDocument = {
  title: string
  file_url: string
  embedding: unknown
}

function getMessageText(message: UIMessage | undefined): string {
  if (!message) return ''

  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join('')
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) return 0

  let dot = 0
  let leftMagnitude = 0
  let rightMagnitude = 0

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index]
    leftMagnitude += left[index] * left[index]
    rightMagnitude += right[index] * right[index]
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) return 0
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude))
}

function parseEmbedding(value: unknown): number[] | null {
  if (Array.isArray(value) && value.every((item) => typeof item === 'number')) {
    return value
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return parseEmbedding(parsed)
    } catch {
      return null
    }
  }

  return null
}

async function extractTextFromStorageOrUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fileUrl: string,
  bucketName: 'personal_documents' | 'documents'
): Promise<string | null> {
  const match = fileUrl.match(new RegExp(`/${bucketName}/([^?]+)`))
  const storagePath = match?.[1] ? decodeURIComponent(match[1]) : (!fileUrl.startsWith('http') ? fileUrl : null)

  if (storagePath) {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(storagePath)

      if (!error && data) {
        const arrayBuffer = await data.arrayBuffer()
        const text = await extractPdfText(Buffer.from(arrayBuffer))
        if (text?.trim()) {
          return text
        }
      }
    } catch (storageError) {
      console.warn(`Authenticated storage download failed for ${storagePath}:`, storageError)
    }
  }

  try {
    const res = await fetch(fileUrl)
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer()
      const text = await extractPdfText(Buffer.from(arrayBuffer))
      if (text?.trim()) {
        return text
      }
    }
  } catch (fetchError) {
    console.warn(`HTTP fetch fallback failed for ${fileUrl}:`, fetchError)
  }

  return null
}

async function getCampusContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  query: string,
  queryEmbedding: number[],
  studentDept: string,
  studentSem: number
): Promise<string[]> {
  const { data: matches, error } = await supabase.rpc('match_documents_hybrid', {
    query_embedding: queryEmbedding,
    query_text: query,
    filter_department: studentDept,
    filter_semester: studentSem,
    match_count: 5,
    rrf_k: 60
  })

  if (error) {
    console.error('RPC Error:', error)
  }

  const matchedChunks = ((matches ?? []) as CampusMatch[])
    .filter((doc) => doc.title && doc.chunk_text)
    .map((doc) => `Campus notice: ${doc.title}\nContent: ${doc.chunk_text}`)

  if (matchedChunks.length > 0) {
    return matchedChunks
  }

  // Fallback: fetch published notices matching student's department & semester
  let fallbackQuery = supabase
    .from('documents')
    .select('title, category, target_departments, target_semesters, dates, deadline, file_url')
    .eq('is_published', true)

  if (studentDept) {
    fallbackQuery = fallbackQuery.contains('target_departments', [studentDept])
  }
  if (studentSem) {
    fallbackQuery = fallbackQuery.contains('target_semesters', [studentSem])
  }

  const { data: documents, error: documentsError } = await fallbackQuery
    .order('created_at', { ascending: false })
    .limit(5)

  if (documentsError) {
    console.error('Campus document fallback error:', documentsError)
    return []
  }

  const contexts: string[] = []
  for (const document of (documents ?? []) as CampusDocument[]) {
    if (!document.file_url) continue

    const text = await extractTextFromStorageOrUrl(supabase, document.file_url, 'documents')
    if (!text) continue

    const depts = document.target_departments && document.target_departments.length > 0 ? document.target_departments.join(', ') : 'All'
    const sems = document.target_semesters && document.target_semesters.length > 0 ? document.target_semesters.join(', ') : 'All'

    contexts.push(
      `Campus notice: ${document.title}
Category: ${document.category ?? 'Not specified'}
Target Departments: ${depts}
Target Semesters: ${sems}
Dates: ${document.dates ?? 'Not specified'}
Deadline: ${document.deadline ?? 'Not specified'}
Content: ${text.slice(0, 6000)}`
    )
  }

  return contexts
}

async function getPersonalContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  query: string,
  queryEmbedding: number[]
): Promise<string[]> {
  const { data: documents, error } = await supabase
    .from('personal_documents')
    .select('title, file_url, embedding')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Personal document lookup error:', error)
    return []
  }

  if (!documents || documents.length === 0) {
    return []
  }

  const queryWords = new Set(query.toLowerCase().split(/\W+/).filter(Boolean))
  const rankedDocuments = ((documents ?? []) as PersonalDocument[])
    .map((document) => {
      const embedding = parseEmbedding(document.embedding)
      const titleWords = document.title.toLowerCase().split(/\W+/).filter(Boolean)
      const titleScore = titleWords.some((word) => queryWords.has(word)) ? 0.3 : 0
      const similarity = embedding ? cosineSimilarity(queryEmbedding, embedding) : 0

      return {
        document,
        score: similarity + titleScore
      }
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)

  const contexts: string[] = []
  for (const { document } of rankedDocuments) {
    if (!document.file_url) continue

    const text = await extractTextFromStorageOrUrl(supabase, document.file_url, 'personal_documents')
    if (!text) continue

    contexts.push(`User's Private Uploaded Document: "${document.title}"\nContent:\n${text.slice(0, 6000)}`)
  }

  return contexts
}

export async function POST(req: Request) {
  try {
    const { messages } = (await req.json()) as { messages?: UIMessage[] }
    if (!messages || messages.length === 0) {
      return Response.json({ error: 'No messages provided' }, { status: 400 })
    }

    const lastMessage = getMessageText(messages[messages.length - 1])
    if (!lastMessage) {
      return Response.json({ error: 'Message text is required' }, { status: 400 })
    }

    // 1. Get user context (department & semester)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const rawDept = user.user_metadata?.department || 'CSE'
    const rawSem = user.user_metadata?.semester || 'Semester 1'

    const { target_departments, target_semesters } = normalizeAudience(rawDept, rawSem)
    const studentDept = target_departments[0] || 'CSE'
    const studentSem = target_semesters[0] || 1

    // 2. Generate embedding for the question using Local Xenova model
    const queryEmbedding = await generateEmbedding(lastMessage)

    const [campusContext, personalContext] = await Promise.all([
      getCampusContext(supabase, lastMessage, queryEmbedding, studentDept, studentSem),
      getPersonalContext(supabase, user.id, lastMessage, queryEmbedding)
    ])

    const contextChunks = [...campusContext, ...personalContext]
    const retrievedContext = contextChunks.length > 0
      ? contextChunks.join('\n\n')
      : 'No relevant documents found.'

    // 5. Build the System Prompt
    const systemPrompt = `You are a helpful campus assistant for engineering students.
Answer the student's question strictly using the provided campus notices and private uploaded document context chunks.
Context: 
${retrievedContext}

Rules:
1. If the answer is not in the context, say "I couldn't find that in the current campus notices or your uploaded documents." Do not use outside knowledge.
2. If citing a date or deadline, explicitly state the name of the source document you found it in.
3. Keep answers brief and direct.`

    // 6. Save the user's incoming message
    await supabase.from('chat_messages').insert({
      user_id: user.id,
      role: 'user',
      content: lastMessage
    })

    // 7. Stream the response back using Vercel AI SDK and Groq
    const modelMessages = await convertToModelMessages(messages)

    const result = streamText({
      model: groq.chat('openai/gpt-oss-120b'),
      system: systemPrompt,
      messages: modelMessages,
      onError: ({ error }) => {
        console.error('Chat stream error:', error)
      },
      async onFinish({ text }) {
        const supabase = await createClient()
        await supabase.from('chat_messages').insert({
          user_id: user.id,
          role: 'assistant',
          content: text
        })
      }
    })

    return result.toUIMessageStreamResponse()
    
  } catch (error: unknown) {
    console.error('Chat API Error:', error)
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
