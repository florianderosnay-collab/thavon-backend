"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Zap } from "lucide-react";

// YOUR RAILWAY URL
const API_URL = "https://web-production-274e.up.railway.app"; 

export default function IntegrationsPage() {
  const [agencyId, setAgencyId] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchAgency = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: member } = await supabase
        .from("agency_members")
        .select("agency_id")
        .eq("user_id", user.id)
        .single();
      if (member) setAgencyId(member.agency_id);
    };
    fetchAgency();
  }, []);

  const webhookUrl = `${API_URL}/webhooks/inbound/${agencyId}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Inbound Integrations</h1>
          <p className="text-slate-500">Connect your lead sources to Thavon for instant speed-to-lead.</p>
        </div>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500 fill-yellow-500" /> 
                Instant Webhook
            </CardTitle>
            <CardDescription>
                When a lead hits this URL, we call them within 30 seconds.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-slate-900 p-4 rounded-lg flex items-center justify-between">
                <code className="text-slate-300 text-sm break-all font-mono">
                    {agencyId ? webhookUrl : "Loading..."}
                </code>
                <Button size="icon" variant="ghost" className="text-white hover:bg-slate-800" onClick={copyToClipboard}>
                    {copied ? <span className="text-green-400 font-bold">✓</span> : <Copy className="w-4 h-4" />}
                </Button>
            </div>
            
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg text-sm text-blue-800">
                <strong>How to use:</strong>
                <ul className="list-disc ml-5 mt-2 space-y-1">
                    <li><strong>Zapier:</strong> Create a Zap. Trigger = "New Lead" (Facebook/Website). Action = "Webhooks by Zapier (POST)" to this URL.</li>
                    <li><strong>Payload:</strong> Ensure you send JSON with <code>name</code>, <code>phone</code>, and <code>address</code>.</li>
                </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}