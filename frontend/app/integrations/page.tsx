"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient"; 
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Copy, Zap, ExternalLink, Key, CheckCircle2, XCircle, 
  Loader2, AlertCircle, ChevronRight, Play, Settings, MessageSquare
} from "lucide-react";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  status: "connected" | "disconnected" | "connecting";
  type: "oauth" | "webhook" | "api_key";
  webhookUrl?: string;
  setupSteps: string[];
  category: "crm" | "automation" | "social";
}

export default function IntegrationsPage() {
  const [agencyId, setAgencyId] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

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
        const baseUrl = typeof window !== 'undefined' 
          ? window.location.origin 
          : '';
        
        // Initialize integrations with webhook URLs
        const initialIntegrations: Integration[] = [
          {
            id: "zapier",
            name: "Zapier",
            description: "Connect any app to Thavon. Automate FSBO lead imports and sync call results.",
            icon: <Zap className="w-6 h-6" />,
            color: "text-yellow-500",
            status: "disconnected",
            type: "webhook",
            webhookUrl: `${baseUrl}/api/webhooks/inbound/${member.agency_id}`,
            setupSteps: [
              "Create a new Zap in Zapier",
              "Choose your trigger app (HubSpot, Salesforce, etc.)",
              "Add 'Webhooks by Zapier' as the action",
              "Paste the webhook URL above",
              "Map fields: name, phone, address",
              "Test and activate your Zap"
            ],
            category: "automation"
          },
          {
            id: "hubspot",
            name: "HubSpot",
            description: "Sync FSBO contacts from HubSpot and push call results back automatically.",
            icon: <Key className="w-6 h-6" />,
            color: "text-orange-500",
            status: "disconnected",
            type: "oauth",
            setupSteps: [
              "Click 'Connect HubSpot' below",
              "Authorize Thavon in HubSpot",
              "Select which HubSpot lists to sync",
              "Configure field mappings",
              "Enable automatic sync"
            ],
            category: "crm"
          },
          {
            id: "salesforce",
            name: "Salesforce",
            description: "Import FSBO leads from Salesforce campaigns and update records with call outcomes.",
            icon: <Key className="w-6 h-6" />,
            color: "text-blue-500",
            status: "disconnected",
            type: "oauth",
            setupSteps: [
              "Click 'Connect Salesforce' below",
              "Log in to your Salesforce account",
              "Grant Thavon access permissions",
              "Select lead sources to sync",
              "Map custom fields if needed"
            ],
            category: "crm"
          },
          {
            id: "pipedrive",
            name: "Pipedrive",
            description: "Automatically import FSBO deals and update pipeline stages based on call results.",
            icon: <Key className="w-6 h-6" />,
            color: "text-orange-500",
            status: "disconnected",
            type: "webhook",
            webhookUrl: `${baseUrl}/api/webhooks/inbound/${member.agency_id}`,
            setupSteps: [
              "Go to Pipedrive Settings > Integrations",
              "Create a new webhook",
              "Paste the webhook URL above",
              "Select 'Deal created' as trigger",
              "Map deal fields to Thavon format",
              "Test the connection"
            ],
            category: "crm"
          },
          {
            id: "facebook",
            name: "Facebook Lead Ads",
            description: "Capture Facebook lead form submissions and call them instantly via Thavon.",
            icon: <Key className="w-6 h-6" />,
            color: "text-blue-600",
            status: "disconnected",
            type: "webhook",
            webhookUrl: `${baseUrl}/api/webhooks/inbound/${member.agency_id}`,
            setupSteps: [
              "Go to Facebook Events Manager",
              "Create a new webhook event",
              "Paste the webhook URL above",
              "Select 'Lead' as the event type",
              "Map form fields (name, phone, email)",
              "Test with a sample lead"
            ],
            category: "social"
          }
        ];
        
        setIntegrations(initialIntegrations);
        
        // Fetch real integration status from API
        try {
          const statusResponse = await fetch(`/api/integrations/status?agencyId=${member.agency_id}`);
          if (statusResponse.ok) {
            const { statusMap } = await statusResponse.json();
            setIntegrations(prev => prev.map(integ => ({
              ...integ,
              status: (statusMap[integ.id] || "disconnected") as "connected" | "disconnected"
            })));
          }
        } catch (error) {
          console.error("Failed to fetch integration status:", error);
        }
        
        setLoading(false);
      }
    };
    fetchAgency();
    
    // Check for OAuth callback success/error
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get("success");
    const error = urlParams.get("error");
    
    if (success || error) {
      // Clean up URL
      window.history.replaceState({}, "", "/integrations");
      
      // Refresh integration status if success
      if (success && agencyId) {
        fetch(`/api/integrations/status?agencyId=${agencyId}`)
          .then(res => res.json())
          .then(({ statusMap }) => {
            setIntegrations(prev => prev.map(integ => ({
              ...integ,
              status: (statusMap[integ.id] || integ.status) as "connected" | "disconnected"
            })));
          });
      }
    }
  }, [agencyId]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleConnect = async (integrationId: string) => {
    if (!agencyId) return;
    
    setIntegrations(prev => prev.map(integ => 
      integ.id === integrationId 
        ? { ...integ, status: "connecting" as const }
        : integ
    ));
    
    try {
      const response = await fetch("/api/integrations/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId, agencyId }),
      });
      
      const data = await response.json();
      
      if (data.authUrl) {
        // OAuth flow - redirect to provider
        window.location.href = data.authUrl;
      } else if (data.success) {
        // Webhook-based - just mark as connected
        setIntegrations(prev => prev.map(integ => 
          integ.id === integrationId 
            ? { ...integ, status: "connected" as const }
            : integ
        ));
      } else {
        throw new Error(data.error || "Connection failed");
      }
    } catch (error: any) {
      console.error("Connection error:", error);
      setIntegrations(prev => prev.map(integ => 
        integ.id === integrationId 
          ? { ...integ, status: "disconnected" as const }
          : integ
      ));
      alert(`Failed to connect: ${error.message}`);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!agencyId) return;
    
    if (!confirm(`Are you sure you want to disconnect ${integrationId}?`)) {
      return;
    }
    
    try {
      const response = await fetch("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId, agencyId }),
      });
      
      if (response.ok) {
        setIntegrations(prev => prev.map(integ => 
          integ.id === integrationId 
            ? { ...integ, status: "disconnected" as const }
            : integ
        ));
      } else {
        throw new Error("Disconnect failed");
      }
    } catch (error: any) {
      console.error("Disconnect error:", error);
      alert(`Failed to disconnect: ${error.message}`);
    }
  };
  
  const handleTestConnection = async (integrationId: string) => {
    if (!agencyId) return;
    
    try {
      const response = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId, agencyId }),
      });
      
      const data = await response.json();
      
      if (data.connected) {
        alert(`✅ ${data.message || "Connection successful!"}`);
      } else {
        alert(`❌ ${data.message || "Connection test failed"}`);
      }
    } catch (error: any) {
      console.error("Test error:", error);
      alert(`Test failed: ${error.message}`);
    }
  };
  
  const handleSync = async (integrationId: string) => {
    if (!agencyId) return;
    
    if (!confirm(`Sync leads from ${integrationId}? This will import new contacts into your leads database.`)) {
      return;
    }
    
    try {
      const response = await fetch("/api/integrations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId, agencyId }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ ${data.message}\n\nFound: ${data.leadsFound} leads\nSaved: ${data.leadsSaved} new leads\nSkipped: ${data.leadsSkipped} duplicates`);
        // Refresh status to show last sync time
        const statusResponse = await fetch(`/api/integrations/status?agencyId=${agencyId}`);
        if (statusResponse.ok) {
          const { statusMap } = await statusResponse.json();
          setIntegrations(prev => prev.map(integ => ({
            ...integ,
            status: (statusMap[integ.id] || integ.status) as "connected" | "disconnected"
          })));
        }
      } else {
        alert(`❌ Sync failed: ${data.error || "Unknown error"}`);
      }
    } catch (error: any) {
      console.error("Sync error:", error);
      alert(`Sync failed: ${error.message}`);
    }
  };

  const getStatusBadge = (status: Integration["status"]) => {
    switch (status) {
      case "connected":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Connected
          </span>
        );
      case "connecting":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Connecting...
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <XCircle className="w-3.5 h-3.5" />
            Not Connected
          </span>
        );
    }
  };

  const groupedIntegrations = {
    crm: integrations.filter(i => i.category === "crm"),
    automation: integrations.filter(i => i.category === "automation"),
    social: integrations.filter(i => i.category === "social")
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-slate-900">Integrations</h1>
          <p className="text-lg text-slate-600">
            Connect your tools to automate FSBO prospecting. Import leads, sync call results, and scale your outbound engine.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Active Connections</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {integrations.filter(i => i.status === "connected").length}
                  </p>
                </div>
                <div className="p-3 bg-violet-100 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-violet-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Available Integrations</p>
                  <p className="text-3xl font-bold text-slate-900">{integrations.length}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Zap className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Leads Synced (24h)</p>
                  <p className="text-3xl font-bold text-slate-900">0</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <Play className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Automation & Workflow Tools */}
        {groupedIntegrations.automation.length > 0 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Automation & Workflow</h2>
              <p className="text-slate-600">Connect any app via Zapier for maximum flexibility</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groupedIntegrations.automation.map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  copied={copied === integration.id}
                  onCopy={() => copyToClipboard(integration.webhookUrl || "", integration.id)}
                  onConnect={() => handleConnect(integration.id)}
                  onDisconnect={() => handleDisconnect(integration.id)}
                  onTest={() => handleTestConnection(integration.id)}
                  onSync={integration.type === "oauth" ? () => handleSync(integration.id) : undefined}
                  getStatusBadge={getStatusBadge}
                />
              ))}
            </div>
          </div>
        )}

        {/* CRM Integrations */}
        {groupedIntegrations.crm.length > 0 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">CRM Platforms</h2>
              <p className="text-slate-600">Sync FSBO leads and call results with your CRM</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groupedIntegrations.crm.map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  copied={copied === integration.id}
                  onCopy={() => copyToClipboard(integration.webhookUrl || "", integration.id)}
                  onConnect={() => handleConnect(integration.id)}
                  onDisconnect={() => handleDisconnect(integration.id)}
                  onTest={() => handleTestConnection(integration.id)}
                  onSync={integration.type === "oauth" ? () => handleSync(integration.id) : undefined}
                  getStatusBadge={getStatusBadge}
                />
              ))}
            </div>
          </div>
        )}

        {/* Social & Lead Sources */}
        {groupedIntegrations.social.length > 0 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Lead Sources</h2>
              <p className="text-slate-600">Capture leads from social platforms and call them instantly</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groupedIntegrations.social.map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  copied={copied === integration.id}
                  onCopy={() => copyToClipboard(integration.webhookUrl || "", integration.id)}
                  onConnect={() => handleConnect(integration.id)}
                  onDisconnect={() => handleDisconnect(integration.id)}
                  onTest={() => handleTestConnection(integration.id)}
                  onSync={integration.type === "oauth" ? () => handleSync(integration.id) : undefined}
                  getStatusBadge={getStatusBadge}
                />
              ))}
            </div>
          </div>
        )}

        {/* Help Section */}
        <Card className="border-none shadow-sm bg-gradient-to-br from-violet-50 to-blue-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-violet-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-violet-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 mb-2">Need Help Setting Up?</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Our integrations are designed to work seamlessly with your existing workflow. 
                  If you need assistance, check our documentation or contact support.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/integrations/docs">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Documentation
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/integrations/support">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Contact Support
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface IntegrationCardProps {
  integration: Integration;
  copied: boolean;
  onCopy: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onTest: () => void;
  onSync?: () => void;
  getStatusBadge: (status: Integration["status"]) => React.ReactNode;
}

function IntegrationCard({ 
  integration, 
  copied, 
  onCopy, 
  onConnect, 
  onDisconnect,
  onTest,
  onSync,
  getStatusBadge 
}: IntegrationCardProps) {
  const [showSetup, setShowSetup] = useState(false);

  return (
    <Card className="border-none shadow-sm bg-white hover:shadow-md transition-shadow h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className={`p-2.5 rounded-lg ${integration.color.replace("text-", "bg-").replace("-500", "-100")}`}>
              <div className={integration.color}>
                {integration.icon}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <CardTitle className="text-lg font-semibold text-slate-900">{integration.name}</CardTitle>
                {getStatusBadge(integration.status)}
              </div>
              <CardDescription className="text-sm text-slate-600 leading-relaxed">
                {integration.description}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 flex flex-col">
        {/* Webhook URL Display */}
        {integration.webhookUrl && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Webhook URL
            </label>
            <div className="flex items-center gap-2">
              <Input
                value={integration.webhookUrl}
                readOnly
                className="font-mono text-xs bg-slate-50 border-slate-200"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={onCopy}
                className="shrink-0 h-9 w-9"
              >
                {copied ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Setup Instructions Toggle */}
        <div className="mt-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSetup(!showSetup)}
            className="w-full justify-between text-slate-600 hover:text-slate-900"
          >
            <span className="text-sm font-medium">Setup Instructions</span>
            <ChevronRight className={`w-4 h-4 transition-transform ${showSetup ? "rotate-90" : ""}`} />
          </Button>
          {showSetup && (
            <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <ol className="space-y-2 text-sm text-slate-700">
                {integration.setupSteps.map((step, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 text-violet-700 font-semibold text-xs flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-3 border-t border-slate-100 mt-auto">
          {integration.status === "connected" ? (
            <>
              {integration.type === "oauth" && onSync && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSync}
                  className="flex-1 bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-200"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Sync Leads
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={onTest}
                className={integration.type === "oauth" && onSync ? "" : "flex-1"}
              >
                <Play className="w-4 h-4 mr-2" />
                Test
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSetup(true)}
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDisconnect}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
              onClick={onConnect}
              disabled={integration.status === "connecting"}
            >
              {integration.status === "connecting" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Connect {integration.name}
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
