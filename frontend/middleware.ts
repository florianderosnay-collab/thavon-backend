import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Skip middleware for auth callback route and onboarding (needs to be accessible without auth)
  if (request.nextUrl.pathname === '/auth/callback' || request.nextUrl.pathname === '/onboarding') {
    return response
  }

  const { data: { user } } = await supabase.auth.getUser()

  // PROTECTED ROUTES LOGIC
  // If user is NOT logged in and tries to access dashboard, kick them to login
  if (!user && request.nextUrl.pathname !== '/login') {
     return NextResponse.redirect(new URL('/login', request.url))
  }

  // If user IS logged in and tries to access login, send them to dashboard
  if (user && request.nextUrl.pathname === '/login') {
     return NextResponse.redirect(new URL('/', request.url))
  }

  // ADMIN ROUTE PROTECTION
  // Protect /admin/* routes - only admins can access
  if (user && request.nextUrl.pathname.startsWith('/admin')) {
    // Check if user is an admin by querying admin_users table
    // The RLS policy "Users can view their own admin status" allows this query
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('id, user_id, email, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    // Log for debugging (will appear in Vercel logs)
    if (adminError || !adminUser) {
      console.log(`❌ Admin access denied for user ${user.id} (${user.email}):`, {
        error: adminError?.message,
        code: adminError?.code,
        details: adminError,
        pathname: request.nextUrl.pathname
      })
    } else {
      console.log(`✅ Admin access granted for user ${user.id} (${user.email})`)
    }

    // If user is not admin, redirect to dashboard
    if (adminError || !adminUser) {
      return NextResponse.redirect(new URL('/?error=admin-access-denied', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth/callback (auth callback route - must be accessible without auth)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|auth/callback).*)',
  ],
}