"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<"request" | "reset">("request");

  useEffect(() => {
    // Check for password reset token in URL hash (Supabase uses hash fragments)
    const checkForResetToken = async () => {
      const hash = window.location.hash;
      const fullUrl = window.location.href;
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reset-password/page.tsx:23',message:'Checking for reset token',data:{hasHash:!!hash,hashLength:hash.length,hashPreview:hash.substring(0,100),fullUrl:fullUrl.substring(0,200),pathname:window.location.pathname,search:window.location.search},timestamp:Date.now(),sessionId:'debug-session',runId:'forgot-password',hypothesisId:'H'})}).catch(()=>{});
      // #endregion

      // Check if we have a hash with access_token or type=recovery
      const hasResetToken = hash && (hash.includes("access_token") || hash.includes("type=recovery"));
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reset-password/page.tsx:33',message:'Hash check result',data:{hasResetToken,hashLength:hash?.length || 0},timestamp:Date.now(),sessionId:'debug-session',runId:'forgot-password',hypothesisId:'I1'})}).catch(()=>{});
      // #endregion

      // If we have hash, Supabase client will automatically process it
      // Wait a moment for Supabase to establish the session from the hash
      if (hasResetToken) {
        // Give Supabase time to process the hash and establish session
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Check if user is authenticated (session should be established from hash)
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reset-password/page.tsx:42',message:'User check result',data:{hasResetToken,hasUser:!!user,userId:user?.id?.substring(0,8),hasError:!!userError,errorMessage:userError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'forgot-password',hypothesisId:'I'})}).catch(()=>{});
      // #endregion

      // If we have a reset token in hash OR user is authenticated, show reset form
      if (hasResetToken || user) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reset-password/page.tsx:47',message:'Setting step to reset',data:{reason:hasResetToken ? 'hash-token' : 'authenticated-user',currentStep:'request'},timestamp:Date.now(),sessionId:'debug-session',runId:'forgot-password',hypothesisId:'J'})}).catch(()=>{});
        // #endregion
        
        // Force set step to reset immediately
        setStep("reset");
        
        // Clear the hash from URL after Supabase has processed it
        if (hasResetToken) {
          setTimeout(() => {
            window.history.replaceState(null, "", window.location.pathname);
          }, 2000);
        }
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reset-password/page.tsx:58',message:'No reset token found, staying on request step',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'forgot-password',hypothesisId:'K'})}).catch(()=>{});
        // #endregion
        // Ensure we're on request step
        setStep("request");
      }
    };

    checkForResetToken();
    
    // Also check on hash change (in case it's set after initial load)
    window.addEventListener("hashchange", checkForResetToken);
    return () => window.removeEventListener("hashchange", checkForResetToken);
  }, []);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 6 || pwd.length > 8) {
      return "Password must be between 6 and 8 characters";
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) {
      return "Password must contain at least one special character";
    }
    return null;
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reset-password/page.tsx:40',message:'Requesting password reset',data:{email,baseUrl:process.env.NEXT_PUBLIC_BASE_URL || window.location.origin},timestamp:Date.now(),sessionId:'debug-session',runId:'forgot-password',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
      // Redirect directly to reset-password page (not through auth/callback)
      // Supabase will append hash fragments with the token
      const redirectUrl = `${baseUrl}/reset-password`;
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reset-password/page.tsx:68',message:'Calling resetPasswordForEmail',data:{email,redirectUrl,baseUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'forgot-password',hypothesisId:'C'})}).catch(()=>{});
      // #endregion

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reset-password/page.tsx:54',message:'Reset password response',data:{hasError:!!error,errorMessage:error?.message,errorCode:error?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'forgot-password',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      if (error) throw error;
      setSuccess(true);
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reset-password/page.tsx:60',message:'Reset password error',data:{errorMessage:err?.message,errorStack:err?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'forgot-password',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      setError(err.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      // Verify user is authenticated (session should be established from hash fragment)
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reset-password/page.tsx:110',message:'Checking user session before reset',data:{hasUser:!!user,userId:user?.id?.substring(0,8),hasError:!!userError,errorMessage:userError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'forgot-password',hypothesisId:'F'})}).catch(()=>{});
      // #endregion

      if (userError || !user) {
        throw new Error("Invalid or expired reset link. Please request a new password reset.");
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reset-password/page.tsx:118',message:'Updating password',data:{userId:user.id.substring(0,8)},timestamp:Date.now(),sessionId:'debug-session',runId:'forgot-password',hypothesisId:'G'})}).catch(()=>{});
      // #endregion

      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reset-password/page.tsx:124',message:'Password update result',data:{hasError:!!error,errorMessage:error?.message,errorCode:error?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'forgot-password',hypothesisId:'H'})}).catch(()=>{});
      // #endregion

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (success && step === "request") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-slate-200 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h2>
            <p className="text-slate-600 mb-6">
              We've sent a password reset link to <strong>{email}</strong>
            </p>
            <Link href="/login">
              <Button variant="outline">Back to login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success && step === "reset") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-slate-200 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Password reset successful</h2>
            <p className="text-slate-600 mb-6">Redirecting to login...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-slate-200 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-violet-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl mb-4 shadow-lg shadow-violet-200">
            T
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
            {step === "request" ? "Reset your password" : "Set new password"}
          </CardTitle>
          <CardDescription>
            {step === "request"
              ? "Enter your email and we'll send you a reset link"
              : "Enter your new password (6-8 characters with at least one special character)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={step === "request" ? handleRequestReset : handleResetPassword}
            className="space-y-4"
          >
            {step === "request" ? (
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  type="email"
                  placeholder="name@agency.com"
                  className="pl-10 h-11 bg-slate-50 border-slate-200"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            ) : (
              <>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <Input
                    type="password"
                    placeholder="New password (6-8 chars, 1 special)"
                    className="pl-10 h-11 bg-slate-50 border-slate-200"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    maxLength={8}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <Input
                    type="password"
                    placeholder="Confirm password"
                    className="pl-10 h-11 bg-slate-50 border-slate-200"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    maxLength={8}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Password must be 6-8 characters with at least one special character
                </p>
              </>
            )}

            {error && (
              <div className="text-red-500 text-sm font-medium text-center bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-semibold"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <div className="flex items-center">
                  {step === "request" ? "Send reset link" : "Reset password"}{" "}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <Link href="/login" className="text-violet-600 hover:underline font-semibold">
              Back to login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="w-full max-w-md border-slate-200 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto" />
          </CardContent>
        </Card>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}

