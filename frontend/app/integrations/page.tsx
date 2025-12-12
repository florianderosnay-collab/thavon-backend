"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient"; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Zap, ExternalLink, Key, Smartphone, Users } from "lucide-react";

export default function IntegrationsPage() {
  const [agencyId, setAgencyId] = useState("");
  const [copied, setCopied] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    const fetchAgency = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: member } = await supabase
        .from("agency_members")
        .select("agency_id")
        .eq("user_id", user.id)
        .single();
      if (member) {
        setAgencyId(member.agency_id);
        // Construct the frontend webhook URL
        // For external webhooks (Zapier), we need the full URL
        // Use NEXT_PUBLIC_BASE_URL environment variable if set, otherwise use current origin
        const baseUrl = typeof window !== 'undefined' 
          ? window.location.origin 
          : '';
        setWebhookUrl(`${baseUrl}/api/webhooks/inbound/${member.agency_id}`);
      }
    };
    fetchAgency();
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Inbound Integrations</h1>
          <p className="text-slate-500">Connect your lead sources for instant speed-to-lead and sync call notes.</p>
        </div>

        {/* TOP CRM CARD */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" /> 
                Real Estate CRMs
            </CardTitle>
            <CardDescription>
                We prioritize dedicated integrations for top-tier CRMs.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border border-slate-200 rounded-lg flex flex-col justify-center items-center">
                  <Key className="w-6 h-6 text-violet-500 mb-2" />
                  <p className="font-semibold text-slate-800">Follow Up Boss</p>
                  <p className="text-xs text-slate-500">API Key Configured in **Agency Config**</p>
              </div>
              <div className="p-4 border border-slate-200 rounded-lg flex flex-col justify-center items-center">
                  <Smartphone className="w-6 h-6 text-green-500 mb-2" />
                  <p className="font-semibold text-slate-800">KVCore</p>
                  <p className="text-xs text-slate-500">Connect via Zapier Webhook</p>
              </div>
              <div className="p-4 border border-slate-200 rounded-lg flex flex-col justify-center items-center">
                  <Users className="w-6 h-6 text-orange-500 mb-2" />
                  <p className="font-semibold text-slate-800">Pipedrive</p>
                  <p className="text-xs text-slate-500">Connect via Zapier Webhook</p>
              </div>
          </CardContent>
        </Card>
        
        {/* ZAPIER WEBHOOK RECEIVER */}
        <Card className="border-none shadow-sm bg-slate-900">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                    <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" /> 
                    Universal Webhook (Zapier/API)
                </CardTitle>
                <CardDescription className="text-slate-400">
                    Use this URL to connect any unlisted lead source for an instant call.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="bg-black p-4 rounded-lg flex items-center justify-between">
                    <code className="text-slate-300 text-sm break-all font-mono mr-4">
                        {agencyId ? webhookUrl : "Loading..."}
                    </code>
                    <Button size="icon" variant="ghost" className="text-white hover:bg-slate-800" onClick={copyToClipboard}>
                        {copied ? <span className="text-green-400 font-bold">✓</span> : <Copy className="w-4 h-4" />}
                    </Button>
                </div>
                
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg text-sm text-blue-800">
                    <strong>Instructions:</strong>
                    <ul className="list-disc ml-5 mt-2 space-y-1">
                        <li>In Zapier, set the Action to **"Webhooks by Zapier (POST)"**.</li>
                        <li>Paste the URL above. Send the lead's <code>name</code>, <code>phone</code>, and <code>address</code> as JSON.</li>
                    </ul>
                </div>
            </CardContent>
        </Card>

      </div>
    </div>
  );
}