import Link from 'next/link'
import { signout } from '@/app/login/actions'

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          403 - Unauthorized
        </h1>
        <p className="text-lg text-gray-600 max-w-md mx-auto">
          You do not have the required role to access this page.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex justify-center rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Go back home
          </Link>
          <form action={signout}>
            <button className="inline-flex justify-center rounded-md bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
