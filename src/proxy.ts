import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Helper to construct redirect response while preserving refreshed session cookies
  const createRedirect = (destination: string) => {
    const redirectResponse = NextResponse.redirect(new URL(destination, request.url))
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  // Intercept any request to /admin/*
  if (pathname.startsWith('/admin')) {
    if (!user) {
      return createRedirect('/login')
    }

    // Check public.admins domain table
    const { data: adminRecord } = await supabase
      .from('admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!adminRecord) {
      return createRedirect('/unauthorized')
    }
  }

  // Protect /student routes
  if (pathname.startsWith('/student')) {
    if (!user) {
      return createRedirect('/login')
    }

    // Check public.students domain table
    const { data: studentRecord } = await supabase
      .from('students')
      .select('id, account_status')
      .eq('id', user.id)
      .maybeSingle()

    if (studentRecord) {
      if (studentRecord.account_status === 'pending') {
        return createRedirect('/login?pending=true')
      }
      if (studentRecord.account_status === 'suspended') {
        return createRedirect('/unauthorized')
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static image/asset extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
