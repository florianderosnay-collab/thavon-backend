"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Building2, User, Phone, Mail, Lock, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface OnboardingData {
  firstName: string;
  lastName: string;
  phone: string;
  companyName: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<OnboardingData>({
    firstName: "",
    lastName: "",
    phone: "",
    companyName: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onboarding/page.tsx:30',message:'Starting onboarding submission',data:{formData},timestamp:Date.now(),sessionId:'debug-session',runId:'onboarding',hypothesisId:'F'})}).catch(()=>{});
    // #endregion

    try {
      // Get the authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onboarding/page.tsx:38',message:'User fetch result',data:{hasUser:!!user,userId:user?.id?.substring(0,8),hasError:!!userError,errorMessage:userError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'onboarding',hypothesisId:'G'})}).catch(()=>{});
      // #endregion

      if (userError || !user) {
        throw new Error("You must be logged in to complete onboarding. Please log in first.");
      }

      // Create agency
      const { data: agency, error: agencyError } = await supabase
        .from("agencies")
        .insert({
          company_name: formData.companyName,
          owner_phone: formData.phone,
          subscription_status: "trial",
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
        })
        .select()
        .single();

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onboarding/page.tsx:50',message:'Agency creation result',data:{hasAgency:!!agency,agencyId:agency?.id?.substring(0,8),hasError:!!agencyError,errorMessage:agencyError?.message,errorCode:agencyError?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'onboarding',hypothesisId:'H'})}).catch(()=>{});
      // #endregion

      if (agencyError) {
        console.error("Agency creation error:", agencyError);
        throw new Error(agencyError.message || "Failed to create agency. Please try again.");
      }

      if (!agency) {
        throw new Error("Failed to create agency. Please try again.");
      }

      // Link user to agency
      const { error: memberError } = await supabase
        .from("agency_members")
        .insert({
          user_id: user.id,
          agency_id: agency.id,
          role: "owner",
        });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onboarding/page.tsx:65',message:'Member creation result',data:{hasError:!!memberError,errorMessage:memberError?.message,errorCode:memberError?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'onboarding',hypothesisId:'I'})}).catch(()=>{});
      // #endregion

      if (memberError) {
        console.error("Member creation error:", memberError);
        // If member creation fails, try to clean up the agency
        await supabase.from("agencies").delete().eq("id", agency.id);
        throw new Error(memberError.message || "Failed to link your account. Please try again.");
      }

      // Update user metadata with full name
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          full_name: `${formData.firstName} ${formData.lastName}`,
          phone: formData.phone,
        },
      });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onboarding/page.tsx:82',message:'User update result',data:{hasError:!!updateError,errorMessage:updateError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'onboarding',hypothesisId:'J'})}).catch(()=>{});
      // #endregion

      if (updateError) {
        console.warn("User metadata update error (non-critical):", updateError);
        // Non-critical, continue anyway
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onboarding/page.tsx:90',message:'Onboarding complete, redirecting',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'onboarding',hypothesisId:'K'})}).catch(()=>{});
      // #endregion

      // Redirect to dashboard
      router.push("/");
      router.refresh();
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'onboarding/page.tsx:95',message:'Onboarding error',data:{errorMessage:err?.message,errorStack:err?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'onboarding',hypothesisId:'L'})}).catch(()=>{});
      // #endregion
      console.error("Onboarding error:", err);
      setError(err.message || "Failed to complete onboarding. Please try again.");
      setLoading(false);
    }
  };

  const validateStep = (): boolean => {
    if (step === 1) {
      return !!(formData.firstName && formData.lastName);
    }
    if (step === 2) {
      return !!formData.phone;
    }
    if (step === 3) {
      return !!formData.companyName;
    }
    return false;
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
            {step === 1 && "Tell us about yourself"}
            {step === 2 && "Contact information"}
            {step === 3 && "Company details"}
          </CardTitle>
          <CardDescription>
            {step === 1 && "We'll use this to personalize your experience"}
            {step === 2 && "How can we reach you?"}
            {step === 3 && "Let's set up your agency"}
          </CardDescription>
        </CardHeader>

        {/* PROGRESS INDICATOR */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-center space-x-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    s < step
                      ? "bg-violet-600 text-white"
                      : s === step
                      ? "bg-violet-600 text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {s < step ? <CheckCircle2 className="w-5 h-5" /> : s}
                </div>
                {s < 3 && (
                  <div
                    className={`w-12 h-1 mx-1 ${
                      s < step ? "bg-violet-600" : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <CardContent>
          <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); setStep(step + 1); }} className="space-y-4">
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="First name"
                      className="pl-10 h-11 bg-slate-50 border-slate-200"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Last name"
                      className="pl-10 h-11 bg-slate-50 border-slate-200"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  type="tel"
                  placeholder="Phone number"
                  className="pl-10 h-11 bg-slate-50 border-slate-200"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
                <p className="text-xs text-slate-500 mt-2">
                  We'll use this to contact you about your account
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Company name"
                  className="pl-10 h-11 bg-slate-50 border-slate-200"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  required
                />
                <p className="text-xs text-slate-500 mt-2">
                  This will be your agency name in the system
                </p>
              </div>
            )}

            {error && (
              <div className="text-red-500 text-sm font-medium text-center bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(step - 1)}
                  disabled={loading}
                >
                  Back
                </Button>
              )}
              <Button
                type="submit"
                className={`${step > 1 ? "flex-1" : "w-full"} h-11 bg-slate-900 hover:bg-slate-800 text-white font-semibold`}
                disabled={loading || !validateStep()}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <div className="flex items-center">
                    {step === 3 ? "Complete Setup" : "Continue"} <ArrowRight className="ml-2 h-4 w-4" />
                  </div>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

