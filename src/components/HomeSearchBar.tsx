'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function HomeSearchBar() {
  const [query, setQuery] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    // Redirect to the dedicated chat UI with the initial query
    router.push(`/student/chat?q=${encodeURIComponent(query)}`)
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">How can I help you today?</h1>
      <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto">
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything about your campus..." 
          className="w-full pl-5 pr-12 py-4 rounded-full border border-gray-300 shadow-sm focus:border-black focus:ring-black text-gray-900 placeholder-gray-400"
        />
        <button 
          type="submit"
          disabled={!query.trim()}
          className="absolute right-2 top-2 p-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
          </svg>
        </button>
      </form>
    </div>
  )
}
