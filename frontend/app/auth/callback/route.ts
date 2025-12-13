import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth/callback/route.ts:4',message:'Auth callback route hit',data:{url:request.url,method:request.method,hasUrl:!!request.url},timestamp:Date.now(),sessionId:'debug-session',runId:'google-auth',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth/callback/route.ts:10',message:'Auth callback params',data:{hasCode:!!code,code:code?.substring(0,10),error,origin,searchParams:Object.fromEntries(searchParams)},timestamp:Date.now(),sessionId:'debug-session',runId:'google-auth',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = {
      get(name: string) {
        return request.headers.get('cookie')?.split('; ').find(row => row.startsWith(`${name}=`))?.split('=')[1]
      },
      set(name: string, value: string, options: CookieOptions) {
        // We can't set cookies in this specific helper, but we don't need to for the exchange
      },
      remove(name: string, options: CookieOptions) {},
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.headers.get('cookie')?.split('; ').find(row => row.startsWith(`${name}=`))?.split('=')[1]
          },
          set(name: string, value: string, options: CookieOptions) {
            // Needed to handle the cookie exchange
            request.headers.set('Set-Cookie', `${name}=${value}`)
          },
          remove(name: string, options: CookieOptions) {},
        },
      }
    )
    
    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth/callback/route.ts:39',message:'Session exchange result',data:{hasError:!!error,errorMessage:error?.message,hasSession:!!data?.session,hasUser:!!data?.user,userId:data?.user?.id?.substring(0,8)},timestamp:Date.now(),sessionId:'debug-session',runId:'google-auth',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    if (!error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth/callback/route.ts:44',message:'Redirecting after success',data:{redirectTo:`${origin}${next}`,origin,next},timestamp:Date.now(),sessionId:'debug-session',runId:'google-auth',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      return NextResponse.redirect(`${origin}${next}`)
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth/callback/route.ts:48',message:'Session exchange error',data:{errorMessage:error.message,errorCode:error.status,errorDetails:error},timestamp:Date.now(),sessionId:'debug-session',runId:'google-auth',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
    }
  }

  // If error, return to login
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth/callback/route.ts:54',message:'Redirecting to login with error',data:{redirectTo:`${origin}/login?error=auth-code-error`,hasCode:!!code,error},timestamp:Date.now(),sessionId:'debug-session',runId:'google-auth',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  return NextResponse.redirect(`${origin}/login?error=auth-code-error`)
}