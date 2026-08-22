'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { AdminSidebarNav } from './AdminSidebarNav'

interface AdminShellProps {
  userEmail: string
  signOutAction: () => Promise<void>
  children: React.ReactNode
}

export function AdminShell({
  userEmail,
  signOutAction,
  children,
}: AdminShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* 1. Desktop Fixed Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:flex-shrink-0 bg-white border-r border-gray-200 justify-between">
        <div>
          <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-200">
            <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
              S
            </div>
            <div className="min-w-0">
              <span className="text-base font-bold text-gray-900 tracking-tight block">Syntheus</span>
              <span className="text-[10px] text-gray-500 font-semibold tracking-wide uppercase block -mt-1">Admin Portal</span>
            </div>
          </div>
          <AdminSidebarNav />
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="mb-3 px-3">
            <p className="text-sm font-semibold text-gray-900 truncate">{userEmail}</p>
            <p className="text-xs text-gray-500 truncate">Administrator</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors border border-transparent hover:border-red-100 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* 2. Mobile Drawer & Backdrop */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  S
                </div>
                <span className="text-base font-bold text-gray-900">Syntheus</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer"
                aria-label="Close menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <AdminSidebarNav onItemClick={() => setMobileMenuOpen(false)} />
            </div>

            <div className="p-4 border-t border-gray-200">
              <div className="mb-3 px-3">
                <p className="text-sm font-semibold text-gray-900 truncate">{userEmail}</p>
                <p className="text-xs text-gray-500 truncate">Administrator</p>
              </div>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors border border-transparent hover:border-red-100 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Content Column */}
      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden">
        {/* Mobile Top Header */}
        <header className="md:hidden flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200 flex-shrink-0 z-10">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none cursor-pointer"
            aria-label="Open navigation menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-black text-white flex items-center justify-center font-bold text-[11px] shadow-xs">
              S
            </div>
            <span className="text-base font-bold text-gray-900">Syntheus</span>
          </div>
          <div className="w-10" />
        </header>

        {/* Scrollable Main Viewport */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  )
}
