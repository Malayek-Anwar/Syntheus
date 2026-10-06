'use client'

import { useChat } from '@ai-sdk/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { DefaultChatTransport, isTextUIPart, type UIMessage } from 'ai'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { SUGGESTED_PROMPTS, type SuggestionPrompt } from '@/utils/constants'
import { findAttentionNotice, markNoticeFinished } from '@/app/student/attention/actions'

export function StudentChat({
  initialMessages,
  suggestions = SUGGESTED_PROMPTS,
}: {
  initialMessages: UIMessage[]
  suggestions?: SuggestionPrompt[]
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQuery = searchParams.get('q')
  const hasTriggeredRef = useRef(false)
  const [input, setInput] = useState('')
  const [chatError, setChatError] = useState<string | null>(null)
  const [isClearing, setIsClearing] = useState(false)
  const [completionCandidate, setCompletionCandidate] = useState<{ id: string; title: string } | null>(null)
  const [completionError, setCompletionError] = useState<string | null>(null)
  const [isCompleting, setIsCompleting] = useState(false)
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/chat' }), [])

  const { messages, status, sendMessage, setMessages } = useChat({
    transport,
    messages: initialMessages,
    onError: (err) => {
      setChatError(err.message || 'Failed to communicate with AI Assistant. Please try again.')
    }
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatError])

  // Trigger initial query if passed via URL
  useEffect(() => {
    if (initialQuery && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true
      sendMessage({ text: initialQuery })
      router.replace('/student/chat')
    }
  }, [initialQuery, sendMessage, router])

  const handleClearChat = async () => {
    if (messages.length === 0 || isClearing || isLoading) return
    setIsClearing(true)
    try {
      const { clearChatHistory } = await import('@/app/student/chat/actions')
      await clearChatHistory()
      setMessages([])
      router.refresh()
    } catch {
      setChatError('Failed to clear chat history.')
    } finally {
      setIsClearing(false)
    }
  }

  const onFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    
    setChatError(null)

    const completionRequest = input.trim().match(/^(?:please\s+)?(?:mark|set)\s+(.+?)\s+(?:as\s+)?(?:finished|complete|completed)$/i)
    if (completionRequest) {
      setCompletionError(null)
      try {
        const result = await findAttentionNotice(completionRequest[1])
        if (result.success && result.notice) {
          setCompletionCandidate({ id: result.notice.id, title: result.notice.title })
        } else {
          setCompletionError(result.error || 'I could not find that attention item.')
        }
      } catch {
        setCompletionError('Failed to search for attention item.')
      }
      setInput('')
      return
    }

    sendMessage({ text: input })
    
    setInput('')
  }

  const confirmCompletion = async () => {
    if (!completionCandidate || isCompleting) return
    setIsCompleting(true)
    try {
      const result = await markNoticeFinished(completionCandidate.id)
      if (result.success) {
        setCompletionCandidate(null)
        router.refresh()
      } else {
        setCompletionError(result.error || 'Could not mark the notice as finished.')
      }
    } catch {
      setCompletionError('Could not mark the notice as finished.')
    } finally {
      setIsCompleting(false)
    }
  }

  const handleSuggestionClick = (queryText: string) => {
    if (isLoading) return
    setChatError(null)
    sendMessage({ text: queryText })
  }

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-xs border border-[#dfe7e3] flex flex-col overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#dfe7e3] bg-white/90 backdrop-blur-sm z-10 sticky top-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#176b61]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Syntheus Intelligence Assistant</h2>
        </div>
        <button
          onClick={handleClearChat}
          disabled={isClearing || isLoading || messages.length === 0}
          className="text-xs font-medium text-slate-400 hover:text-red-600 disabled:opacity-30 transition-colors flex items-center gap-1 cursor-pointer"
          aria-label="Clear chat"
        >
          {isClearing ? 'Clearing...' : 'Clear History'}
        </button>
      </div>

      <div className="flex-1 overflow-hidden p-3 sm:p-5 flex flex-col gap-4">
      {messages.length === 0 && !initialQuery && (
        <div className="text-center space-y-4 my-auto py-8 max-w-lg mx-auto w-full">
          <div className="w-11 h-11 bg-[#edf6f3] text-[#176b61] border border-[#cce5df] rounded-xl flex items-center justify-center mx-auto shadow-2xs">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">How can I assist your studies today?</h1>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Ask about semester circulars, deadlines, fee structures, or your private uploaded course notes.
            </p>
          </div>

          {/* Suggestion prompt cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-left w-full">
            {suggestions.map((prompt) => (
              <button
                key={prompt.label}
                type="button"
                onClick={() => handleSuggestionClick(prompt.query)}
                className="group p-3 rounded-xl bg-[#fbfcfb] hover:bg-[#edf6f3] border border-[#dfe7e3] hover:border-[#a9d2c9] text-left transition-all cursor-pointer shadow-2xs active:scale-98"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 group-hover:text-[#176b61]">{prompt.label}</span>
                  <span className="text-slate-400 group-hover:text-[#176b61] transition-transform group-hover:translate-x-0.5 text-xs">→</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 group-hover:text-slate-700">{prompt.query}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 px-1 min-h-0">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-4 sm:px-5 py-3 text-xs sm:text-sm ${
                m.role === 'user' 
                  ? 'bg-[#176b61] text-white rounded-br-none shadow-2xs'
                  : 'bg-[#fbfcfb] text-slate-900 rounded-bl-none border border-[#dfe7e3] shadow-2xs'
              }`}
            >
                {m.role === 'user' ? (
                  <div className="whitespace-pre-wrap leading-relaxed break-words">
                    {m.parts.filter(isTextUIPart).map((part) => part.text).join('')}
                  </div>
                ) : (
                  <div className="text-xs sm:text-sm text-gray-900 leading-relaxed break-words">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: ({ ...props }) => (
                          <div className="overflow-x-auto my-3 rounded-lg border border-gray-300 shadow-2xs">
                            <table className="w-full text-left border-collapse text-xs" {...props} />
                          </div>
                        ),
                        thead: ({ ...props }) => (
                          <thead className="bg-gray-200/80 text-gray-900 font-bold border-b border-gray-300" {...props} />
                        ),
                        th: ({ ...props }) => (
                          <th className="px-3 py-2 text-xs font-bold text-gray-900 border-r border-gray-300 last:border-r-0" {...props} />
                        ),
                        td: ({ ...props }) => (
                          <td className="px-3 py-2 text-xs text-gray-800 border-b border-gray-200 border-r border-gray-200 last:border-r-0 bg-white" {...props} />
                        ),
                        ul: ({ ...props }) => (
                          <ul className="list-disc pl-5 my-1.5 space-y-1" {...props} />
                        ),
                        ol: ({ ...props }) => (
                          <ol className="list-decimal pl-5 my-1.5 space-y-1" {...props} />
                        ),
                        li: ({ ...props }) => (
                          <li className="text-gray-800 leading-relaxed" {...props} />
                        ),
                        h1: ({ ...props }) => (
                          <h1 className="text-base font-bold text-gray-950 mt-3 mb-1.5" {...props} />
                        ),
                        h2: ({ ...props }) => (
                          <h2 className="text-sm font-bold text-gray-950 mt-2.5 mb-1" {...props} />
                        ),
                        h3: ({ ...props }) => (
                          <h3 className="text-xs sm:text-sm font-bold text-gray-950 mt-2 mb-1" {...props} />
                        ),
                        p: ({ ...props }) => (
                          <p className="mb-2 last:mb-0 leading-relaxed" {...props} />
                        ),
                        strong: ({ ...props }) => (
                          <strong className="font-semibold text-gray-950" {...props} />
                        ),
                        code: ({ className, children, ...props }) => {
                          const isLanguage = Boolean(className?.includes('language-'))
                          const isMultiLine = typeof children === 'string' && children.includes('\n')
                          const isInline = !isLanguage && !isMultiLine
                          return isInline ? (
                            <code className="bg-gray-200/90 text-gray-900 px-1.5 py-0.5 rounded text-[11px] sm:text-xs font-mono font-medium" {...props}>
                              {children}
                            </code>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          )
                        },
                        pre: ({ ...props }) => (
                          <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto text-xs my-2 font-mono" {...props} />
                        ),
                        a: ({ ...props }) => (
                          <a className="text-[#176b61] hover:text-[#12564f] underline font-medium" target="_blank" rel="noopener noreferrer" {...props} />
                        ),
                      }}
                    >
                      {m.parts.filter(isTextUIPart).map((part) => part.text).join('')}
                    </ReactMarkdown>
                  </div>
                )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-500 rounded-2xl rounded-bl-none px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm border border-gray-200 animate-pulse flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#72b5aa] animate-ping" />
              Searching campus knowledge base...
            </div>
          </div>
        )}
        {chatError && (
          <div className="flex justify-start animate-in fade-in duration-150">
            <div className="max-w-[90%] sm:max-w-[85%] rounded-2xl rounded-bl-none px-4 sm:px-5 py-3 text-xs sm:text-sm bg-red-50 text-red-700 border border-red-200 shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{chatError}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setChatError(null)}
                className="text-red-500 hover:text-red-800 text-xs font-semibold underline flex-shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {(completionCandidate || completionError) && (
          <div className="flex justify-start">
            <div className="max-w-[90%] rounded-2xl rounded-bl-none px-4 py-3 text-xs sm:text-sm bg-[#f4faf8] text-gray-800 border border-[#cce5df] shadow-xs">
              {completionCandidate ? (
                <>
                  <p>Mark <strong>{completionCandidate.title}</strong> as finished?</p>
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={confirmCompletion} disabled={isCompleting} className="rounded-full bg-[#176b61] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                      {isCompleting ? 'Saving...' : 'Confirm'}
                    </button>
                    <button type="button" onClick={() => setCompletionCandidate(null)} className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700">
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <p>{completionError}</p>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      </div>

      {/* Quick Prompt Chips (Visible during active conversation) */}
      {messages.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto py-2 px-3 border-t border-[#dfe7e3] bg-[#fbfcfb] no-scrollbar flex-shrink-0">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex-shrink-0 mr-1">Suggested:</span>
          {suggestions.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              disabled={isLoading}
              onClick={() => handleSuggestionClick(prompt.query)}
              className="inline-flex items-center text-xs bg-white hover:bg-[#edf6f3] text-slate-700 hover:text-[#176b61] border border-[#dfe7e3] hover:border-[#a9d2c9] rounded-full px-3 py-1 whitespace-nowrap transition-all cursor-pointer disabled:opacity-50 flex-shrink-0 active:scale-95 shadow-2xs"
            >
              {prompt.label}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={onFormSubmit} className="relative p-3 border-t border-[#dfe7e3] bg-white flex-shrink-0">
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about campus circulars, deadlines, or documents..." 
          className="w-full pl-4 sm:pl-5 pr-12 sm:pr-14 py-3 rounded-full border border-[#dfe7e3] bg-[#fbfcfb] focus:bg-white shadow-2xs focus:border-[#176b61] focus:ring-2 focus:ring-[#176b61]/15 text-xs sm:text-sm text-slate-900 placeholder-slate-400 outline-none transition-all"
          disabled={isLoading}
        />
        <button 
          type="submit"
          disabled={isLoading || !input.trim()}
          className="absolute right-4.5 sm:right-5 top-4.5 sm:top-4.5 p-2 sm:p-2 bg-[#176b61] hover:bg-[#12564f] active:bg-[#0e453f] text-white rounded-full transition-colors disabled:opacity-40 flex items-center justify-center cursor-pointer shadow-xs"
          aria-label="Send message"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
          </svg>
        </button>
      </form>
    </div>
  )
}
