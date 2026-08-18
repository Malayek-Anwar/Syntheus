'use client'

import { useChat } from '@ai-sdk/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { DefaultChatTransport, isTextUIPart, type UIMessage } from 'ai'

export function StudentChat({ initialMessages }: { initialMessages: UIMessage[] }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQuery = searchParams.get('q')
  const hasTriggeredRef = useRef(false)
  const [input, setInput] = useState('')
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/chat' }), [])

  const { messages, status, sendMessage } = useChat({
    transport,
    messages: initialMessages,
    onError: (err) => {
      alert(`Chat Error: ${err.message}`)
    }
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
    
    sendMessage({ text: input })
    
    setInput('')
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col w-full h-[calc(100vh-8rem)]">
      
      {messages.length === 0 && !initialQuery && (
        <div className="text-center space-y-4 my-auto">
          <h1 className="text-2xl font-bold text-gray-900">AI Campus Assistant</h1>
          <p className="text-sm text-gray-500">Ask about campus notices, exams, deadlines, and events.</p>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-6 px-2">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm ${
                m.role === 'user' 
                  ? 'bg-black text-white rounded-br-none' 
                  : 'bg-gray-100 text-gray-900 rounded-bl-none border border-gray-200 shadow-sm'
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed">
                {m.parts.filter(isTextUIPart).map((part) => part.text).join('')}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-500 rounded-2xl rounded-bl-none px-5 py-3 text-sm border border-gray-200 animate-pulse">
              Searching campus knowledge base...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={onFormSubmit} className="relative mt-auto">
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about your campus..." 
          className="w-full pl-5 pr-14 py-4 rounded-full border border-gray-300 shadow-sm focus:border-black focus:ring-black text-gray-900 placeholder-gray-400"
          disabled={isLoading}
        />
        <button 
          type="submit"
          disabled={isLoading || !input.trim()}
          className="absolute right-2 top-2 p-2.5 bg-black text-white rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
          </svg>
        </button>
      </form>
    </div>
  )
}
