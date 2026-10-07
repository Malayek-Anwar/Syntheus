import { verifyStudentSession } from '@/utils/auth'
import { getErrorMessage } from '@/utils/errors'
import { convertToModelMessages, isTextUIPart, streamText, type UIMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { generateEmbedding } from '@/utils/embeddings'
import { isDocumentVisibleToStudent } from '@/utils/audience'

const groq = createOpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
})

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

type RetrievedSource = {
  content: string
  document_id: string | null
  personal_document_id: string | null
  source_title: string
  score: number
}

export async function POST(req: Request) {
  try {
    // 1. Strict student session verification (AI Chat is student-only in V1)
    const auth = await verifyStudentSession()
    if (!auth.authorized || !auth.student) {
      return new Response('Unauthorized: Active student account required', { status: 401 })
    }

    const { student, supabase } = auth

    const body = await req.json()
    const { messages, conversationId: incomingConvId } = body as {
      messages?: UIMessage[]
      conversationId?: string
    }

    if (!messages || messages.length === 0) {
      return Response.json({ error: 'No messages provided' }, { status: 400 })
    }

    const lastMessage = getMessageText(messages[messages.length - 1])
    if (!lastMessage) {
      return Response.json({ error: 'Message text is required' }, { status: 400 })
    }

    // 2. Resolve or create chat conversation
    let conversationId = incomingConvId

    if (conversationId) {
      const { data: existingConv } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('student_id', student.id)
        .maybeSingle()

      if (!existingConv) {
        conversationId = undefined
      }
    }

    if (!conversationId) {
      // Find latest conversation or create new one
      const { data: latestConv } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('student_id', student.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestConv) {
        conversationId = latestConv.id
      } else {
        const titleSnippet = lastMessage.slice(0, 30).trim() || 'New Chat'
        const { data: newConv, error: convError } = await supabase
          .from('chat_conversations')
          .insert({
            student_id: student.id,
            title: titleSnippet,
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single()

        if (convError || !newConv) {
          throw new Error('Failed to create chat conversation')
        }
        conversationId = newConv.id
      }
    }

    // 3. Generate embedding for query
    const queryEmbedding = await generateEmbedding(lastMessage)
    const nowIso = new Date().toISOString()

    // 4. Retrieve Institutional Chunks matching targeting & active status
    const { data: instDocuments } = await supabase
      .from('documents')
      .select('id, title, category, target_departments, target_semesters, target_sections, expires_at')
      .eq('status', 'published')
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)

    const eligibleDocIds = (instDocuments ?? [])
      .filter((doc) =>
        isDocumentVisibleToStudent(doc, {
          department: student.department,
          semester: student.semester,
          section: student.section,
        })
      )
      .map((d) => d.id)

    const docTitleMap = new Map((instDocuments ?? []).map((d) => [d.id, d.title]))

    const candidateSources: RetrievedSource[] = []

    if (eligibleDocIds.length > 0) {
      const { data: chunks } = await supabase
        .from('document_chunks')
        .select('document_id, content, embedding')
        .in('document_id', eligibleDocIds)
        .limit(60)

      for (const chunk of chunks ?? []) {
        const rawEmb = chunk.embedding as unknown
        const embArray = Array.isArray(rawEmb)
          ? (rawEmb as number[])
          : typeof rawEmb === 'string'
          ? (JSON.parse(rawEmb) as number[])
          : []

        if (embArray.length === queryEmbedding.length) {
          const sim = cosineSimilarity(queryEmbedding, embArray)
          candidateSources.push({
            content: chunk.content,
            document_id: chunk.document_id,
            personal_document_id: null,
            source_title: docTitleMap.get(chunk.document_id) || 'Institutional Document',
            score: sim,
          })
        }
      }
    }

    // 5. Retrieve Personal Chunks strictly scoped to current student
    const { data: personalDocs } = await supabase
      .from('personal_documents')
      .select('id, title')
      .eq('student_id', student.id)
      .eq('status', 'ready')

    const personalDocIds = (personalDocs ?? []).map((d) => d.id)
    const personalTitleMap = new Map((personalDocs ?? []).map((d) => [d.id, d.title]))

    if (personalDocIds.length > 0) {
      const { data: personalChunks } = await supabase
        .from('personal_document_chunks')
        .select('personal_document_id, content, embedding')
        .in('personal_document_id', personalDocIds)
        .limit(40)

      for (const chunk of personalChunks ?? []) {
        const rawEmb = chunk.embedding as unknown
        const embArray = Array.isArray(rawEmb)
          ? (rawEmb as number[])
          : typeof rawEmb === 'string'
          ? (JSON.parse(rawEmb) as number[])
          : []

        if (embArray.length === queryEmbedding.length) {
          const sim = cosineSimilarity(queryEmbedding, embArray)
          candidateSources.push({
            content: chunk.content,
            document_id: null,
            personal_document_id: chunk.personal_document_id,
            source_title: personalTitleMap.get(chunk.personal_document_id) || 'Personal Document',
            score: sim,
          })
        }
      }
    }

    // Rank and select top 5 chunks
    candidateSources.sort((a, b) => b.score - a.score)
    const topSources = candidateSources.slice(0, 5)

    const contextText = topSources.length > 0
      ? topSources
          .map((src) => `[Source: ${src.source_title}]\n${src.content}`)
          .join('\n\n---\n\n')
      : 'No relevant documents found.'

    // 6. Save User message in chat_messages
    await supabase.from('chat_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: lastMessage,
    })

    // 7. System Prompt with strict grounding
    const systemPrompt = `You are the Syntheus Academic Intelligence Assistant for university students.
Answer questions accurately, strictly grounded in the provided institutional documents and the student's personal documents.
If an answer is not provided in the context, clearly state: "I couldn't find that in the official campus documents or your uploaded files."
When providing answers, mention the title of the document that provided the information.

Context:
${contextText}`

    const modelMessages = await convertToModelMessages(messages)

    const result = streamText({
      model: groq.chat('openai/gpt-oss-120b'),
      system: systemPrompt,
      messages: modelMessages,
      onError: ({ error }) => {
        console.error('Chat stream error:', error)
      },
      async onFinish({ text }) {
        try {
          // Save Assistant message
          const { data: assistantMsg } = await supabase
            .from('chat_messages')
            .insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: text,
            })
            .select('id')
            .single()

          // Record message sources in message_sources table
          if (assistantMsg && topSources.length > 0) {
            const seenSources = new Set<string>()
            const sourceRows = []

            for (const src of topSources) {
              const key = `${src.document_id || ''}-${src.personal_document_id || ''}`
              if (!seenSources.has(key)) {
                seenSources.add(key)
                sourceRows.push({
                  message_id: assistantMsg.id,
                  document_id: src.document_id,
                  personal_document_id: src.personal_document_id,
                  source_title: src.source_title,
                })
              }
            }

            if (sourceRows.length > 0) {
              await supabase.from('message_sources').insert(sourceRows)
            }
          }

          // Update conversation timestamp
          await supabase
            .from('chat_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId)
        } catch (postErr) {
          console.error('Error saving assistant message and sources:', postErr)
        }
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (error: unknown) {
    console.error('Chat API Error:', error)
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
