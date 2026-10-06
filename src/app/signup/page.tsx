import { signup } from '@/app/login/actions'
import Link from 'next/link'
import { BrandLogo } from '@/components/BrandLogo'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const resolvedParams = await searchParams
  const message = resolvedParams?.message

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <BrandLogo iconSize="w-10 h-10" textSize="text-3xl" />
          <h2 className="mt-8 text-2xl font-bold leading-9 tracking-tight text-gray-900">
            Create your student account
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Already a member?{' '}
            <Link href="/login" className="font-semibold text-[#176b61] hover:text-[#12564f] transition-colors hover:underline">
              Sign in to your account
            </Link>
          </p>

          <div className="mt-8">
            {message && (
              <div className="mb-6 p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2 animate-in fade-in duration-150">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{message}</span>
              </div>
            )}

            <form action={signup} className="space-y-5">
              <div>
                <label htmlFor="email-address" className="block text-sm font-medium leading-6 text-gray-900">
                  Email address
                </label>
                <div className="mt-2">
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="block w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-[#176b61] sm:text-sm sm:leading-6"
                    placeholder="name@college.edu"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-900">
                  Password
                </label>
                <div className="mt-2">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                    className="block w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-[#176b61] sm:text-sm sm:leading-6"
                    placeholder="Min. 6 characters"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="department" className="block text-sm font-medium leading-6 text-gray-900">
                  Department
                </label>
                <div className="mt-2">
                  <select
                    id="department"
                    name="department"
                    required
                    className="block w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-[#176b61] sm:text-sm sm:leading-6"
                  >
                    <option value="">Select Department</option>
                    <option value="CSE">CSE (Computer Science)</option>
                    <option value="ECE">ECE (Electronics & Communication)</option>
                    <option value="ME">ME (Mechanical Engineering)</option>
                    <option value="CE">CE (Civil Engineering)</option>
                    <option value="IT">IT (Information Technology)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="semester" className="block text-sm font-medium leading-6 text-gray-900">
                  Semester
                </label>
                <div className="mt-2">
                  <select
                    id="semester"
                    name="semester"
                    required
                    className="block w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-[#176b61] sm:text-sm sm:leading-6"
                  >
                    <option value="">Select Semester</option>
                    <option value="Semester 1">Semester 1</option>
                    <option value="Semester 2">Semester 2</option>
                    <option value="Semester 3">Semester 3</option>
                    <option value="Semester 4">Semester 4</option>
                    <option value="Semester 5">Semester 5</option>
                    <option value="Semester 6">Semester 6</option>
                    <option value="Semester 7">Semester 7</option>
                    <option value="Semester 8">Semester 8</option>
                  </select>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="flex w-full justify-center rounded-lg bg-[#176b61] px-3 py-2.5 text-sm font-semibold leading-6 text-white shadow-xs hover:bg-[#12564f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176b61] transition-colors cursor-pointer"
                >
                  Create account
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="relative hidden w-0 flex-1 lg:block bg-gray-900">
        <div className="absolute inset-0 bg-[#176b61] opacity-90" />
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0ibm9uZSIvPgo8Y2lyY2xlIGN4PSIzIiBjeT0iMyIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjE1KSIvPgo8L3N2Zz4=')] opacity-30" />
        
        <div className="absolute inset-0 flex flex-col justify-center px-12 lg:px-24">
          <div className="max-w-2xl text-white">
            <h1 className="text-4xl font-bold tracking-tight mb-6">
              Welcome to the future of campus communications.
            </h1>
            <p className="text-lg text-[#d8eee9] mb-10 leading-relaxed">
              Syntheus is an intelligent, AI-powered portal designed to streamline notices, documents, and academic updates. 
              Never miss a deadline or search endlessly for a circular again.
            </p>

            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 backdrop-blur-sm border border-white/20">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Instant AI Insights</h3>
                  <p className="mt-1 text-[#d8eee9]">Ask questions directly to circulars and instantly extract deadlines, rules, and crucial details without reading pages of text.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 backdrop-blur-sm border border-white/20">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Semantic Search</h3>
                  <p className="mt-1 text-[#d8eee9]">Find exactly what you need. Search by context, not just keywords. &ldquo;When is the hackathon?&rdquo; gets you straight to the answer.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 backdrop-blur-sm border border-white/20">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Personalized Feed</h3>
                  <p className="mt-1 text-[#d8eee9]">Only see what matters to you. Notices are automatically filtered by your department and semester.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
