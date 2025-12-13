import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { validateAndSanitize, passwordResetSchema, sanitizeEmail } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // SECURITY: Validate and sanitize input
    const validation = validateAndSanitize(passwordResetSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { email } = validation.data;
    const sanitizedEmail = sanitizeEmail(email);

    // Rate limiting by email address (prevents email enumeration)
    const rateLimitKey = getRateLimitKey(req, sanitizedEmail);
    const rateLimitResult = checkRateLimit(
      `password-reset:${rateLimitKey}`,
      RATE_LIMITS.PASSWORD_RESET
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "Too many password reset requests. Please try again later.",
          resetTime: rateLimitResult.resetTime,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": RATE_LIMITS.PASSWORD_RESET.maxRequests.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
            "Retry-After": Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Create Supabase client
    const cookieHeader = req.headers.get('cookie') || '';
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieHeader.split('; ').find(row => row.startsWith(`${name}=`))?.split('=')[1];
          },
          set() {},
          remove() {},
        },
      }
    );

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const redirectUrl = `${baseUrl}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(sanitizedEmail, {
      redirectTo: redirectUrl,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Always return success (prevents email enumeration)
    return NextResponse.json(
      { message: "If an account exists, a password reset link has been sent." },
      {
        status: 200,
        headers: {
          "X-RateLimit-Limit": RATE_LIMITS.PASSWORD_RESET.maxRequests.toString(),
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
        },
      }
    );
  } catch (error: any) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

