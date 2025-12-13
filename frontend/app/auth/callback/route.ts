import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth/callback/route.ts:4',message:'Auth callback route hit',data:{url:request.url,method:request.method,hasUrl:!!request.url},timestamp:Date.now(),sessionId:'debug-session',runId:'google-auth',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  const { searchParams, origin, hash } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  // Note: hash fragments are not available in server-side URL parsing
  // They need to be handled client-side
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth/callback/route.ts:10',message:'Auth callback params',data:{hasCode:!!code,code:code?.substring(0,10),error,origin,searchParams:Object.fromEntries(searchParams)},timestamp:Date.now(),sessionId:'debug-session',runId:'google-auth',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  // if "next" is in param, use it as the redirect URL
  // For password reset, check if the URL contains recovery indicators
  const urlString = request.url;
  const isPasswordResetFlow = urlString.includes("type=recovery") || urlString.includes("#type=recovery");
  const next = isPasswordResetFlow ? '/reset-password' : (searchParams.get('next') ?? '/')

  // Create response object to set cookies on
  const response = NextResponse.redirect(`${origin}${next}`)

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            // Set cookies on the response object
            request.cookies.set({
              name,
              value,
              ...options,
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
            response.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )
    
    // Exchange the code for a session
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth/callback/route.ts:49',message:'Session exchange result',data:{hasError:!!exchangeError,errorMessage:exchangeError?.message,hasSession:!!data?.session,hasUser:!!data?.user,userId:data?.user?.id?.substring(0,8),sessionExpires:data?.session?.expires_at},timestamp:Date.now(),sessionId:'debug-session',runId:'google-auth',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    if (!exchangeError && data?.session) {
      // Check if this is a password reset flow
      // Supabase password reset can be detected by checking the session metadata
      // or by checking if the redirect URL contains recovery indicators
      const urlString = request.url;
      const isPasswordReset = 
        urlString.includes("type=recovery") || 
        urlString.includes("#type=recovery") ||
        searchParams.get("type") === "recovery" ||
        // Check session metadata for recovery type
        (data.session as any)?.user?.recovery_sent_at;
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth/callback/route.ts:68',message:'Checking password reset flow',data:{urlString:urlString.substring(0,200),isPasswordReset,hasTypeParam:!!searchParams.get("type"),typeParam:searchParams.get("type"),hasCode:!!code},timestamp:Date.now(),sessionId:'debug-session',runId:'password-reset',hypothesisId:'J'})}).catch(()=>{});
      // #endregion

      if (isPasswordReset) {
        // Password reset - redirect to reset password page
        // Hash fragments will be preserved by the browser automatically
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth/callback/route.ts:79',message:'Redirecting to reset password',data:{redirectTo:`${origin}/reset-password`},timestamp:Date.now(),sessionId:'debug-session',runId:'password-reset',hypothesisId:'K'})}).catch(()=>{});
        // #endregion
        return NextResponse.redirect(`${origin}/reset-password`)
      }

      // Check if user needs onboarding (no agency membership)
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: member } = await supabaseAdmin
        .from("agency_members")
        .select("agency_id")
        .eq("user_id", data.session.user.id)
        .maybeSingle();

      // Redirect to onboarding if no agency membership, otherwise use the original redirect
      const finalRedirect = member ? next : "/onboarding";
      const finalResponse = NextResponse.redirect(`${origin}${finalRedirect}`);
      
      // Copy cookies to final response
      response.cookies.getAll().forEach(cookie => {
        finalResponse.cookies.set(cookie.name, cookie.value, cookie);
      });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth/callback/route.ts:75',message:'Redirecting after success',data:{redirectTo:`${origin}${finalRedirect}`,hasMember:!!member,needsOnboarding:!member},timestamp:Date.now(),sessionId:'debug-session',runId:'google-auth',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      return finalResponse
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth/callback/route.ts:59',message:'Session exchange error',data:{errorMessage:exchangeError?.message,errorCode:exchangeError?.status,errorDetails:exchangeError,hasSession:!!data?.session},timestamp:Date.now(),sessionId:'debug-session',runId:'google-auth',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(exchangeError?.message || 'auth-code-error')}`)
    }
  }

  // If error, return to login
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth/callback/route.ts:66',message:'Redirecting to login with error',data:{redirectTo:`${origin}/login?error=auth-code-error`,hasCode:!!code,error},timestamp:Date.now(),sessionId:'debug-session',runId:'google-auth',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  return NextResponse.redirect(`${origin}/login?error=auth-code-error`)
}