'use client'

import { useChat } from '@ai-sdk/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { DefaultChatTransport, isTextUIPart, type UIMessage } from 'ai'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { SUGGESTED_PROMPTS, type SuggestionPrompt } from '@/utils/constants'

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
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/chat' }), [])

  const { messages, status, sendMessage } = useChat({
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

  const onFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    
    setChatError(null)
    sendMessage({ text: input })
    
    setInput('')
  }

  const handleSuggestionClick = (queryText: string) => {
    if (isLoading) return
    setChatError(null)
    sendMessage({ text: queryText })
  }

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col w-full h-full min-h-0 flex-1 overflow-hidden">
      
      {messages.length === 0 && !initialQuery && (
        <div className="text-center space-y-4 my-auto py-6 max-w-lg mx-auto w-full">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl flex items-center justify-center mx-auto shadow-md">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">AI Campus Assistant</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Ask about campus notices, exams, deadlines, schedules, and your uploaded private documents.</p>
          </div>

          {/* Suggestion prompt cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-left w-full">
            {suggestions.map((prompt) => (
              <button
                key={prompt.label}
                type="button"
                onClick={() => handleSuggestionClick(prompt.query)}
                className="group p-3 rounded-xl bg-white hover:bg-blue-50/50 border border-gray-200 hover:border-blue-300 text-left transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-98"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-900 group-hover:text-blue-700">{prompt.label}</span>
                  <span className="text-gray-400 group-hover:text-blue-600 transition-transform group-hover:translate-x-0.5 text-xs">→</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-1 group-hover:text-gray-700">{prompt.query}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto mb-3 sm:mb-4 space-y-4 sm:space-y-6 px-1 sm:px-2 min-h-0">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm ${
                m.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none shadow-xs' 
                  : 'bg-gray-100 text-gray-900 rounded-bl-none border border-gray-200 shadow-xs'
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
                          const isInline = !className?.includes('language-')
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
                          <a className="text-blue-600 hover:text-blue-800 underline font-medium" target="_blank" rel="noopener noreferrer" {...props} />
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
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-ping" />
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
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Chips (Visible during active conversation) */}
      {messages.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 px-1 scrollbar-none flex-shrink-0">
          <span className="text-[11px] text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/50 flex-shrink-0 mr-0.5">Quick:</span>
          {suggestions.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              disabled={isLoading}
              onClick={() => handleSuggestionClick(prompt.query)}
              className="inline-flex items-center text-xs bg-white hover:bg-blue-50 text-gray-700 hover:text-blue-700 border border-gray-200 hover:border-blue-300 rounded-full px-2.5 py-1 whitespace-nowrap transition-all cursor-pointer disabled:opacity-50 flex-shrink-0 active:scale-95 shadow-2xs"
            >
              {prompt.label}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={onFormSubmit} className="relative mt-auto pt-1 flex-shrink-0">
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about your campus..." 
          className="w-full pl-4 sm:pl-5 pr-12 sm:pr-14 py-3 sm:py-3.5 rounded-full border border-gray-300 shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 text-xs sm:text-sm md:text-base text-gray-900 placeholder-gray-400 outline-none transition-all"
          disabled={isLoading}
        />
        <button 
          type="submit"
          disabled={isLoading || !input.trim()}
          className="absolute right-1.5 sm:right-2 top-2.5 sm:top-2.5 p-2 sm:p-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer shadow-xs"
          aria-label="Send message"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
            <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
          </svg>
        </button>
      </form>
    </div>
  )
}
