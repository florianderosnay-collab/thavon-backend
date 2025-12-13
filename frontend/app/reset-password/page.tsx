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
    const token = searchParams.get("token");
    if (token) {
      setStep("reset");
    }
  }, [searchParams]);

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

    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${baseUrl}/reset-password`,
      });

      if (error) throw error;
      setSuccess(true);
    } catch (err: any) {
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
      const token = searchParams.get("token");
      if (!token) {
        throw new Error("Invalid reset link");
      }

      const { error } = await supabase.auth.updateUser({
        password: password,
      });

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
              : "Enter your new password"}
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

