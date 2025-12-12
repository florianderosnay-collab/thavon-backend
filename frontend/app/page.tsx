"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { supabase } from "@/lib/supabaseClient"; 
import { 
  Phone, Users, CalendarCheck, TrendingUp, Play, Activity,
  History, CheckCircle2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// YOUR RAILWAY URL (Used by the backend to trigger calls)
const API_URL = "https://web-production-274e.up.railway.app"; 

// --- HELPER FUNCTION: Calculates days left in trial ---
const calculateTrialDays = (trialEndDate: string | null) => {
    if (!trialEndDate) return 0;
    const end = new Date(trialEndDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("System Standby");
  const [agency, setAgency] = useState<any>(null); 
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);

  // 1. Fetch Agency Data and Check Trial on Load
  useEffect(() => {
    const checkAccess = async () => {
      try {
        setInitialLoading(true);
        
        // Get logged-in user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.error("User authentication error:", userError);
          setInitialLoading(false);
          return;
        }

        // Get user's agency membership
        const { data: member, error: memberError } = await supabase
          .from("agency_members")
          .select("agency_id")
          .eq("user_id", user.id)
          .single();

        if (memberError || !member) {
          console.error("Agency membership error:", memberError);
          setInitialLoading(false);
          return;
        }

        // Fetch agency data including subscription_status
        const { data: agencyData, error: agencyError } = await supabase
          .from("agencies")
          .select("id, subscription_status, trial_ends_at, stripe_customer_id")
          .eq("id", member.agency_id)
          .single();

        if (agencyError) {
          console.error("Agency fetch error:", agencyError);
          setInitialLoading(false);
          return;
        }

        if (agencyData) {
          setAgency(agencyData);
          setTrialDaysLeft(calculateTrialDays(agencyData.trial_ends_at));
        }
      } catch (error) {
        console.error("Unexpected error fetching agency data:", error);
      } finally {
        setInitialLoading(false);
      }
    };
    
    checkAccess();
  }, []);

  const handleStartCampaign = async () => {
    // Safety check: Ensure agency data is loaded
    if (!agency) {
      alert("⚠️ Agency information not loaded. Please refresh the page.");
      return;
    }
    
    // --- THE GATEKEEPER: Subscription Status Check ---
    const isTrialActive = trialDaysLeft > 0;
    const subscriptionActive = agency.subscription_status === 'active';
    
    // Block execution if subscription is not 'active' AND trial is not active
    if (!subscriptionActive && !isTrialActive) {
      alert("⚠️ Trial Ended: Your trial has expired. Please upgrade to continue hunting.");
      return;
    }

    // Additional safety check: prevent double-clicks during loading
    if (loading) {
      return;
    }

    setLoading(true);
    setStatus("Identifying Agency...");
    
    try {
      setStatus("Initiating AI Agents...");
      const response = await axios.post(`${API_URL}/start-campaign`, { 
        agency_id: agency.id 
      });
      
      setStatus(`Success: ${response.data.message}`);
    } catch (error: any) {
      console.error("Checkout Failed:", error);
      
      const apiErrorMessage = error.response?.data?.error || "Unknown error occurred. Check Vercel Logs for /api/checkout.";
      
      alert(`Could not initialize checkout. API Error: ${apiErrorMessage}`);
      setStatus(`Error: ${error.message || "Connection failed"}`);
    }
    setLoading(false);
  };

  const handleUpgrade = async () => {
    if (!agency) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const response = await axios.post("/api/checkout", {
        agencyId: agency.id,
        email: user?.email
      });

      window.location.href = response.data.url;
    } catch (error: any) {
      console.error("Checkout Failed:", error);
      const apiErrorMessage = error.response?.data?.error || "Unknown error occurred.";
      alert(`Could not initialize checkout. API Error: ${apiErrorMessage}`);
      setLoading(false);
    }
  };

  const isPro = agency?.subscription_status === 'active';
  const isTrial = agency?.subscription_status === 'free' && trialDaysLeft > 0;
  const isExpired = agency?.subscription_status === 'free' && trialDaysLeft <= 0;
  const isReadyToHunt = isPro || isTrial; 

  // Dynamic Status Message for the Pricing Box
  let pricingStatusMessage = "";
  if (isPro) {
      pricingStatusMessage = "You're on the Pro Plan. Happy Hunting!";
  } else if (isTrial) {
      pricingStatusMessage = `Free Trial Active. ${trialDaysLeft} days remaining.`;
  } else if (isExpired) {
      pricingStatusMessage = "Trial Expired. Upgrade to Pro to resume hunting.";
  } else {
      pricingStatusMessage = "Checking subscription status...";
  }


  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      
      {/* TOP NAVIGATION / HEADER */}
      <div className="max-w-6xl mx-auto mb-10 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-gradient-to-br from-violet-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-200">
             <span className="text-white font-bold text-xl">T</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">THAVON</h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Agency Control Center</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* KEY METRICS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard icon={Users} label="Total Leads" value="1,240" sub="+12% this week" />
          <StatCard icon={Phone} label="Calls Attempted" value="842" sub="68% connection rate" />
          <StatCard icon={CalendarCheck} label="Appointments" value="18" sub="Next: Tue 14:00" highlight />
          <StatCard icon={TrendingUp} label="Pipeline Value" value="€2.4M" sub="Based on avg. comm." />
        </div>

        {/* MAIN CONTROL AREA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: THE AI LAUNCHPAD */}
          <Card className="col-span-2 border-none shadow-xl shadow-slate-200/60 overflow-hidden bg-white">
            {/* The colored bar turns GRAY if not Pro */}
            <div className={`absolute top-0 left-0 w-full h-1 ${isPro ? "bg-gradient-to-r from-violet-500 to-blue-500" : "bg-slate-300"}`}></div>
            
            <CardHeader className="pb-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl text-slate-900">Outbound Campaigns</CardTitle>
                  <CardDescription className="mt-1 text-slate-500">
                    Deploy AI agents to cold call 'New' leads from the database.
                  </CardDescription>
                </div>
                {/* Visual Indicator: AI READY vs LOCKED */}
                {isPro ? (
                    <div className="bg-violet-50 text-violet-700 px-3 py-1 rounded-full text-xs font-bold border border-violet-100 flex items-center gap-2">
                        <Activity className="w-3 h-3" /> PRO ACTIVE
                    </div>
                ) : isTrial ? (
                    <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100 flex items-center gap-2">
                         <Activity className="w-3 h-3" /> TRIAL ACTIVE
                    </div>
                ) : (
                    <div className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold border border-slate-200">
                        LOCKED
                    </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                <div>
                   <p className="text-sm font-semibold text-slate-700">Subscription Status</p>
                   <p className="text-xs text-slate-500 mt-1">{pricingStatusMessage}</p>
                </div>
              </div>

              {/* THE ACTION BUTTON (Conditional) */}
              <div className="flex flex-col gap-4">
                {isReadyToHunt ? (
                    // IF PAID OR TRIAL: Show the Start Button
                    <Button 
                        onClick={handleStartCampaign} 
                        disabled={loading || !agency || !isReadyToHunt}
                        className="w-full h-14 text-lg font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                        <span className="animate-pulse">Initializing Neural Network...</span>
                        ) : (
                        <>
                            <Play className="w-5 h-5 fill-current" /> START HUNTING
                        </>
                        )}
                    </Button>
                ) : (
                    // IF EXPIRED: Show the Upgrade Button
                    <Button 
                        onClick={handleUpgrade} // Calls your API to redirect to Stripe Checkout
                        disabled={loading}
                        className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg hover:opacity-90 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        🚀 UPGRADE TO PRO (€500/mo)
                    </Button>
                )}
                
                <p className={`text-center text-sm font-medium ${status.includes('Success') ? 'text-green-600' : 'text-slate-400'}`}>
                   {isReadyToHunt ? status : "Upgrade required to launch campaigns."}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* RIGHT: RECENT ACTIVITY FEED */}
          <Card className="border-slate-100 shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-400" /> Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 relative">
                {/* Connector Line */}
                <div className="absolute left-[19px] top-2 bottom-2 w-[1px] bg-slate-100"></div>

                <TimelineItem 
                  time="Just now" 
                  title="Appointment Booked" 
                  desc="Florian @ 8001 Strassen"
                  type="success"
                />
                <TimelineItem 
                  time="2 mins ago" 
                  title="Voicemail Drop" 
                  desc="+352 691 55..."
                  type="neutral"
                />
                <TimelineItem 
                  time="10 mins ago" 
                  title="Objection Handled" 
                  desc="'Bring me a buyer' -> Overcome"
                  type="neutral"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// --- SUB COMPONENTS (KEEP AS IS) ---

function StatCard({ icon: Icon, label, value, sub, highlight }: any) {
  return (
    <Card className={`border-none shadow-sm transition-all hover:shadow-md ${highlight ? 'bg-gradient-to-br from-violet-50 to-white border-violet-100 border' : 'bg-white'}`}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-2 rounded-lg ${highlight ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-600'}`}>
            <Icon className="w-5 h-5" />
          </div>
          {highlight && <div className="h-2 w-2 bg-violet-500 rounded-full animate-pulse"></div>}
        </div>
        <div>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">{label}</p>
          <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
          <p className="text-xs text-slate-400 mt-1">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineItem({ time, title, desc, type }: any) {
    let iconColor = "bg-slate-200 text-slate-500";
    if (type === 'success') iconColor = "bg-green-100 text-green-600";
    if (type === 'system') iconColor = "bg-blue-100 text-blue-600";
  
    return (
      <div className="relative pl-12">
        <div className={`absolute left-0 top-1 h-10 w-10 rounded-full ${iconColor} flex items-center justify-center border-4 border-white z-10`}>
          {type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <div className="h-2 w-2 bg-current rounded-full" />}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
          <span className="text-[10px] font-mono text-slate-400 mt-1 block">{time}</span>
        </div>
      </div>
    );
}