"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Lock, Mail, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Account created! Check your email to verify.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // Use environment variable for production, fallback to window.location.origin for local dev
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
    const redirectTo = `${baseUrl}/auth/callback`;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/page.tsx:42',message:'Initiating Google OAuth',data:{redirectTo,baseUrl,windowOrigin:window.location.origin,hasEnvVar:!!process.env.NEXT_PUBLIC_BASE_URL},timestamp:Date.now(),sessionId:'debug-session',runId:'google-auth',hypothesisId:'H'})}).catch(()=>{});
    // #endregion

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo,
      },
    });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/page.tsx:50',message:'OAuth response',data:{hasError:!!error,errorMessage:error?.message,hasUrl:!!data?.url,url:data?.url?.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'google-auth',hypothesisId:'I'})}).catch(()=>{});
    // #endregion

    if (error) {
      console.error('Google OAuth error:', error);
      alert(`Authentication error: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      {/* BACKGROUND DECORATION */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      </div>

      <Card className="w-full max-w-md border-slate-200 shadow-xl bg-white/80 backdrop-blur-sm relative z-10">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-violet-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl mb-4 shadow-lg shadow-violet-200">
            T
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
            {isSignUp ? "Create your account" : "Welcome back"}
          </CardTitle>
          <CardDescription>
            Enter your credentials to access the core.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* GOOGLE LOGIN BUTTON */}
          <Button 
            variant="outline" 
            className="w-full h-11 bg-white border-slate-300 hover:bg-slate-50 text-slate-700 font-medium"
            onClick={handleGoogleLogin}
          >
            <svg className="mr-2 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
              <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
            </svg>
            Continue with Google
          </Button>

          {/* DIVIDER */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-500">Or continue with</span>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
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
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input 
                  type="password" 
                  placeholder="••••••••" 
                  className="pl-10 h-11 bg-slate-50 border-slate-200"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-sm font-medium text-center bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-semibold" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <div className="flex items-center">
                  {isSignUp ? "Sign Up" : "Sign In"} <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-slate-500">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}
            </span>
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="ml-2 font-semibold text-violet-600 hover:underline"
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}