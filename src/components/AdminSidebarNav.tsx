'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  name: string
  href: string
  exact?: boolean
  icon: (props: { className?: string }) => React.ReactNode
}

const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/admin',
    exact: true,
    icon: ({ className }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
]

export function AdminSidebarNav({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="p-4 space-y-1.5">
      {navItems.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => onItemClick?.()}
            className={`group flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-all ${
              isActive
                ? 'bg-[#e8f3f0] text-[#176b61] font-semibold'
                : 'text-gray-600 hover:bg-[#f1f5f3] hover:text-gray-900'
            }`}
          >
            <item.icon
              className={`w-5 h-5 flex-shrink-0 transition-colors ${
                isActive ? 'text-[#176b61]' : 'text-gray-400 group-hover:text-gray-600'
              }`}
            />
            <span>{item.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}
