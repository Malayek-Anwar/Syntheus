import Link from 'next/link'
import { signout } from '@/app/login/actions'
import { BrandLogo } from '@/components/BrandLogo'

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-gray-200 text-center space-y-6">
        <div className="flex justify-center mb-6">
          <BrandLogo iconSize="w-10 h-10" textSize="text-2xl" />
        </div>
        
        <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Access Restricted
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            You do not have the required permissions or role to access this portal.
          </p>
        </div>
        
        <div className="flex gap-3 justify-center pt-2">
          <Link
            href="/"
            className="inline-flex justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-2xs border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Go back home
          </Link>
          <form action={signout}>
            <button className="inline-flex justify-center rounded-xl bg-[#176b61] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#12564f] transition-colors cursor-pointer shadow-xs">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
