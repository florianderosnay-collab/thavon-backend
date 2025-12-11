"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Building2, Save, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function SettingsPage() {
  const [agency, setAgency] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    const init = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // 1. Get Agency Link
        const { data: member } = await supabase.from("agency_members").select("agency_id").eq("user_id", user.id).single();
        if (!member) return;

        // 2. Get Agency Details
        const { data: agencyData } = await supabase.from("agencies").select("*").eq("id", member.agency_id).single();
        
        if (agencyData) {
            setAgency(agencyData);
            setCompanyName(agencyData.company_name);
            setPhone(agencyData.owner_phone || "");
        }
    };
    init();
  }, []);

  const handleUpdate = async () => {
    if (!agency) return;
    setLoading(true);
    
    await supabase.from("agencies").update({
        company_name: companyName,
        owner_phone: phone
    }).eq("id", agency.id);
    
    setLoading(false);
    alert("Settings saved.");
  };

  if (!agency) return <div className="p-8 text-slate-500">Loading settings...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
            <h1 className="text-3xl font-bold text-slate-900">Agency Settings</h1>
            <p className="text-slate-500">Manage your company profile and subscription.</p>
        </div>

        {/* GENERAL SETTINGS */}
        <Card className="border-none shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5 text-violet-600"/> General Information</CardTitle>
                <CardDescription>Visible on your invoices and reports.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Company Name</label>
                        <Input value={companyName} onChange={e => setCompanyName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Admin Phone</label>
                        <Input value={phone} onChange={e => setPhone(e.target.value)} />
                    </div>
                </div>
                <div className="pt-2">
                    <label className="text-sm font-medium text-slate-700">Agency ID (For Support)</label>
                    <div className="p-3 bg-slate-100 rounded-md font-mono text-xs text-slate-500 mt-1 select-all">
                        {agency.id}
                    </div>
                </div>
                <div className="flex justify-end pt-4">
                    <Button onClick={handleUpdate} disabled={loading} className="bg-slate-900 text-white">
                        {loading ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                    </Button>
                </div>
            </CardContent>
        </Card>

        {/* SUBSCRIPTION PLACEHOLDER */}
        <Card className="border-none shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-violet-600"/> Subscription</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between p-4 bg-violet-50 border border-violet-100 rounded-lg">
                    <div>
                        <p className="font-semibold text-violet-900">Pro Plan (Early Access)</p>
                        <p className="text-sm text-violet-600">You are currently on the pilot program.</p>
                    </div>
                    <Button variant="secondary" className="bg-white text-violet-700 border border-violet-200">Manage Billing</Button>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}