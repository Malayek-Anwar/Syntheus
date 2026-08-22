'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SUGGESTED_PROMPTS, type SuggestionPrompt } from '@/utils/constants'

export function HomeSearchBar({ suggestions = SUGGESTED_PROMPTS }: { suggestions?: SuggestionPrompt[] }) {
  const [query, setQuery] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    // Redirect to the dedicated chat UI with the initial query
    router.push(`/student/chat?q=${encodeURIComponent(query)}`)
  }

  const handlePromptClick = (promptQuery: string) => {
    router.push(`/student/chat?q=${encodeURIComponent(promptQuery)}`)
  }

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200 text-center space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">How can I help you today?</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">Search through campus notices, exam schedules, department circulars, and private documents.</p>
      </div>

      <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto">
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything about your campus..." 
          className="w-full pl-5 pr-14 py-4 rounded-full border border-gray-300 shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 text-sm sm:text-base text-gray-900 placeholder-gray-400 transition-all outline-none"
        />
        <button 
          type="submit"
          disabled={!query.trim()}
          className="absolute right-2 top-2 p-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          aria-label="Search"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
          </svg>
        </button>
      </form>

      {/* One-Click Suggestion Chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1 max-w-2xl mx-auto">
        <span className="text-xs text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/50 mr-1 flex items-center gap-1">
          <span>💡</span> Try:
        </span>
        {suggestions.map((prompt) => (
          <button
            key={prompt.label}
            type="button"
            onClick={() => handlePromptClick(prompt.query)}
            className="inline-flex items-center text-xs font-medium bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 hover:border-blue-300 rounded-full px-3 py-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
          >
            {prompt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
