'use client'

import { useState, useTransition, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { BrandLogo } from '@/components/BrandLogo'
import { createClient } from '@/utils/supabase/client'
import { RegistrationPendingModal } from '@/components/RegistrationPendingModal'
import { normalizeSection } from '@/utils/audience'

function SignupContent() {
  const searchParams = useSearchParams()
  const initialPending = searchParams.get('pending') === 'true'
  const initialMessage = searchParams.get('message')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [institutionalName, setInstitutionalName] = useState(searchParams.get('name') || '')
  const [rollNumber, setRollNumber] = useState(searchParams.get('roll') || '')
  const [department, setDepartment] = useState(searchParams.get('dept') || '')
  const [semester, setSemester] = useState(searchParams.get('sem') || '')
  const [section, setSection] = useState(searchParams.get('sec') || '')

  const [errorMessage, setErrorMessage] = useState<string | null>(initialMessage || null)
  const [isPending, startTransition] = useTransition()
  const [showModal, setShowModal] = useState<boolean>(initialPending)
  const [modalDetails, setModalDetails] = useState<{
    name: string
    rollNumber: string
    department: string
    semester: string | number
    section?: string | null
    email: string
  }>({
    name: searchParams.get('name') || '',
    rollNumber: searchParams.get('roll') || '',
    department: searchParams.get('dept') || '',
    semester: searchParams.get('sem') || '',
    section: searchParams.get('sec') || null,
    email: searchParams.get('email') || '',
  })

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)

    const trimmedRoll = rollNumber.trim()
    const trimmedName = institutionalName.trim()
    const trimmedDept = department.trim()
    const semesterNum = parseInt(semester.replace(/\D/g, ''), 10)
    const normalizedSec = normalizeSection(section)

    if (!trimmedRoll || !trimmedName || !trimmedDept || !semesterNum) {
      setErrorMessage('Please fill in all required academic fields.')
      return
    }

    startTransition(async () => {
      try {
        const supabase = createClient()

        // 1. Sign up user via Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              institutional_name: trimmedName,
              roll_number: trimmedRoll,
              department: trimmedDept,
              semester: semesterNum,
              section: normalizedSec,
            },
          },
        })

        if (authError) {
          setErrorMessage(authError.message)
          return
        }

        const user = authData.user
        if (!user) {
          setErrorMessage('Failed to initialize account. Please try again.')
          return
        }

        // Check if user already existed (empty identities check)
        if (user.identities && user.identities.length === 0) {
          setErrorMessage('An account with this email address already exists. Please sign in instead.')
          return
        }

        // 2. Check if student row already exists for this user
        const { data: existingStudent } = await supabase
          .from('students')
          .select('id, roll_number, account_status')
          .eq('id', user.id)
          .maybeSingle()

        if (!existingStudent) {
          // 3. Create initial pending claim in students table
          const { error: insertError } = await supabase
            .from('students')
            .insert({
              id: user.id,
              roll_number: trimmedRoll,
              account_status: 'pending',
              institutional_name: trimmedName,
              display_name: trimmedName,
              department: trimmedDept,
              semester: semesterNum,
              section: normalizedSec,
            })

          if (insertError) {
            // Check for unique roll number conflict
            if (
              insertError.code === '23505' ||
              insertError.message?.toLowerCase().includes('unique') ||
              insertError.message?.toLowerCase().includes('roll_number')
            ) {
              setErrorMessage(
                `Roll number "${trimmedRoll}" is already registered. If you already have an account, please sign in.`
              )
              return
            }
            setErrorMessage(`Registration error: ${insertError.message}`)
            return
          }
        }

        // 4. Update modal details and activate verification pop-up
        setModalDetails({
          name: trimmedName,
          rollNumber: trimmedRoll,
          department: trimmedDept,
          semester: semesterNum,
          section: normalizedSec,
          email: email,
        })

        // Sign out session so pending unverified account doesn't retain access
        await supabase.auth.signOut()
        setShowModal(true)
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.')
      }
    })
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Pop-up modal informing the student of pending verification */}
      <RegistrationPendingModal
        isOpen={showModal}
        studentDetails={modalDetails}
      />

      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <BrandLogo iconSize="w-10 h-10" textSize="text-3xl" />
          <h2 className="mt-8 text-2xl font-bold leading-9 tracking-tight text-gray-900">
            Create your student account
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Already registered?{' '}
            <Link
              href="/login"
              className="font-semibold text-[#176b61] hover:text-[#12564f] transition-colors hover:underline"
            >
              Sign in to your account
            </Link>
          </p>

          <div className="mt-8">
            {errorMessage && (
              <div className="mb-6 p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2 animate-in fade-in duration-150">
                <svg
                  className="w-5 h-5 text-red-500 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email-address" className="block text-xs font-semibold text-gray-700">
                  Email address *
                </label>
                <div className="mt-1">
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 py-2 px-3 text-gray-900 text-xs sm:text-sm focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] outline-none"
                    placeholder="name@college.edu"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-gray-700">
                  Password *
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 py-2 px-3 text-gray-900 text-xs sm:text-sm focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] outline-none"
                    placeholder="Min. 6 characters"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="institutional_name" className="block text-xs font-semibold text-gray-700">
                    Full Name *
                  </label>
                  <div className="mt-1">
                    <input
                      id="institutional_name"
                      name="institutional_name"
                      type="text"
                      required
                      value={institutionalName}
                      onChange={(e) => setInstitutionalName(e.target.value)}
                      className="block w-full rounded-lg border border-gray-300 py-2 px-3 text-gray-900 text-xs sm:text-sm focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] outline-none"
                      placeholder="e.g. Alex Sharma"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="roll_number" className="block text-xs font-semibold text-gray-700">
                    Roll Number *
                  </label>
                  <div className="mt-1">
                    <input
                      id="roll_number"
                      name="roll_number"
                      type="text"
                      required
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      className="block w-full rounded-lg border border-gray-300 py-2 px-3 text-gray-900 text-xs sm:text-sm uppercase focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] outline-none"
                      placeholder="e.g. 21CS042"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="department" className="block text-xs font-semibold text-gray-700">
                  Department *
                </label>
                <div className="mt-1">
                  <select
                    id="department"
                    name="department"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 py-2 px-3 text-gray-900 text-xs sm:text-sm focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] outline-none bg-white"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="semester" className="block text-xs font-semibold text-gray-700">
                    Semester *
                  </label>
                  <div className="mt-1">
                    <select
                      id="semester"
                      name="semester"
                      required
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      className="block w-full rounded-lg border border-gray-300 py-2 px-3 text-gray-900 text-xs sm:text-sm focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] outline-none bg-white"
                    >
                      <option value="">Select</option>
                      <option value="1">Sem 1</option>
                      <option value="2">Sem 2</option>
                      <option value="3">Sem 3</option>
                      <option value="4">Sem 4</option>
                      <option value="5">Sem 5</option>
                      <option value="6">Sem 6</option>
                      <option value="7">Sem 7</option>
                      <option value="8">Sem 8</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="section" className="block text-xs font-semibold text-gray-700">
                    Section (optional)
                  </label>
                  <div className="mt-1">
                    <input
                      id="section"
                      name="section"
                      type="text"
                      maxLength={4}
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      className="block w-full rounded-lg border border-gray-300 py-2 px-3 text-gray-900 text-xs sm:text-sm uppercase focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] outline-none"
                      placeholder="e.g. A"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex w-full justify-center rounded-lg bg-[#176b61] px-3 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-[#12564f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176b61] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isPending ? 'Registering Claim...' : 'Create Student Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="relative hidden w-0 flex-1 lg:block bg-gray-900">
        <div className="absolute inset-0 bg-[#176b61] opacity-90" />
        <div className="absolute inset-0 flex flex-col justify-center px-12 lg:px-24">
          <div className="max-w-2xl text-white space-y-6">
            <h1 className="text-4xl font-bold tracking-tight">
              Syntheus — Academic Intelligence Platform
            </h1>
            <p className="text-lg text-[#d8eee9] leading-relaxed">
              Institutional notices, official timetables, exam schedules, and intelligent grounded student RAG.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#176b61]"></div>
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  )
}
