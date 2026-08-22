'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { SuggestionPrompt } from '@/utils/constants'

interface HomeAiHeroProps {
  suggestions?: SuggestionPrompt[]
  department?: string
  semester?: number
}

export function HomeAiHero({
  suggestions = [],
  department = 'CSE',
  semester = 1,
}: HomeAiHeroProps) {
  const router = useRouter()

  const handlePromptClick = (promptQuery: string) => {
    router.push(`/student/chat?q=${encodeURIComponent(promptQuery)}`)
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 via-indigo-900 to-gray-950 text-white p-6 sm:p-8 shadow-md border border-blue-800/40 space-y-6">
      {/* Background ambient glow effect */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner Row */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase bg-blue-500/20 text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-400/30">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Syntheus AI Intelligence
            </span>
            <span className="text-xs text-gray-300 font-medium">
              {department} • Semester {semester}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Ask questions, verify rules & search circulars
          </h1>
          <p className="text-xs sm:text-sm text-gray-300 max-w-2xl leading-relaxed">
            Syntheus AI synthesizes published institutional notices and your private class notes into instant, verified answers.
          </p>
        </div>

        <Link
          href="/student/chat"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-all flex-shrink-0 group cursor-pointer"
        >
          <span>Open AI Assistant</span>
          <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Link>
      </div>

      {/* 1-Tap Quick Question Chips */}
      {suggestions.length > 0 && (
        <div className="relative z-10 pt-2 border-t border-white/10 space-y-2">
          <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
            <span>💡</span>
            <span>Quick 1-tap questions:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {suggestions.map((prompt) => (
              <button
                key={prompt.label}
                type="button"
                onClick={() => handlePromptClick(prompt.query)}
                className="inline-flex items-center text-xs font-medium bg-white/10 hover:bg-white/20 text-gray-100 hover:text-white border border-white/15 hover:border-white/30 rounded-xl px-3.5 py-2 transition-all shadow-2xs cursor-pointer active:scale-95 text-left"
              >
                <span>{prompt.label}</span>
                <span className="ml-1.5 text-blue-300 font-bold">→</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
