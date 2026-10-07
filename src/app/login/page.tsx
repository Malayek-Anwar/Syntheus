import { login } from './actions'
import Link from 'next/link'
import { BrandLogo } from '@/components/BrandLogo'
import { AccountPendingModal } from '@/components/AccountPendingModal'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    message?: string
    pending?: string
    name?: string
    roll?: string
    dept?: string
    sem?: string
    sec?: string
  }>
}) {
  const resolvedParams = await searchParams
  const message = resolvedParams?.message
  const isPending = resolvedParams?.pending === 'true' || resolvedParams?.pending === '1'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
      {isPending && (
        <AccountPendingModal
          isOpen={true}
          studentDetails={{
            name: resolvedParams?.name,
            rollNumber: resolvedParams?.roll,
            department: resolvedParams?.dept,
            semester: resolvedParams?.sem,
            section: resolvedParams?.sec,
          }}
        />
      )}

      <div className="w-full max-w-md space-y-8 bg-white p-8 sm:p-10 shadow-sm border border-gray-200 rounded-2xl">
        <div className="flex flex-col items-center justify-center text-center">
          <BrandLogo iconSize="w-10 h-10" textSize="text-3xl" className="justify-center" />
          <h2 className="mt-6 text-xl font-bold tracking-tight text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Welcome back to the intelligent campus portal
          </p>
        </div>

        {message && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2 animate-in fade-in duration-150">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{message}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" action={login}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 block w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-[#176b61] sm:text-sm sm:leading-6 shadow-xs"
                placeholder="name@college.edu"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 block w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-[#176b61] sm:text-sm sm:leading-6 shadow-xs"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="submit"
              className="flex w-full justify-center rounded-lg bg-[#176b61] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#12564f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176b61] transition-colors shadow-xs cursor-pointer"
            >
              Sign in
            </button>
          </div>
          
          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              Not registered?{' '}
              <Link href="/signup" className="font-semibold text-[#176b61] hover:text-[#12564f] hover:underline transition-colors">
                Create an account
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
