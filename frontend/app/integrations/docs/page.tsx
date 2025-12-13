"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Zap, Key, ExternalLink, CheckCircle2, AlertCircle, 
  ArrowLeft, Copy, Mail, MessageSquare, Phone
} from "lucide-react";
import Link from "next/link";

export default function IntegrationsDocsPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/integrations">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Integrations
            </Button>
          </Link>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Integration Documentation</h1>
          <p className="text-slate-600 text-lg">
            Complete setup guides for all Thavon integrations
          </p>
        </div>

        {/* Table of Contents */}
        <Card className="mb-8 border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle>Quick Navigation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a href="#zapier" className="text-violet-600 hover:text-violet-700 font-medium">
                Zapier Setup
              </a>
              <a href="#hubspot" className="text-violet-600 hover:text-violet-700 font-medium">
                HubSpot Setup
              </a>
              <a href="#salesforce" className="text-violet-600 hover:text-violet-700 font-medium">
                Salesforce Setup
              </a>
              <a href="#pipedrive" className="text-violet-600 hover:text-violet-700 font-medium">
                Pipedrive Setup
              </a>
              <a href="#facebook" className="text-violet-600 hover:text-violet-700 font-medium">
                Facebook Lead Ads
              </a>
              <a href="#troubleshooting" className="text-violet-600 hover:text-violet-700 font-medium">
                Troubleshooting
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Zapier Documentation */}
        <Card id="zapier" className="mb-8 border-none shadow-sm bg-white">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Zap className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <CardTitle>Zapier Integration</CardTitle>
                <CardDescription>Connect any app to Thavon via Zapier</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Overview</h3>
              <p className="text-slate-600 mb-4">
                Zapier allows you to connect Thavon with over 6,000 apps. When a new lead comes in from 
                any connected app (HubSpot, Salesforce, Facebook, etc.), Thavon will automatically call 
                them within seconds.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Setup Steps</h3>
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center">
                    1
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">Get Your Webhook URL</p>
                    <p className="text-sm text-slate-600">
                      Go to the Integrations page and copy your unique webhook URL. It looks like:
                      <code className="block mt-2 p-2 bg-slate-50 rounded text-xs font-mono">
                        https://app.thavon.io/api/webhooks/inbound/[your-agency-id]
                      </code>
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center">
                    2
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">Create a New Zap</p>
                    <p className="text-sm text-slate-600">
                      In Zapier, create a new Zap. Choose your trigger app (e.g., HubSpot, Salesforce, 
                      Facebook Lead Ads, etc.) as the trigger.
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center">
                    3
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">Add Webhooks by Zapier</p>
                    <p className="text-sm text-slate-600 mb-2">
                      Add "Webhooks by Zapier" as the action. Choose "POST" method.
                    </p>
                    <p className="text-sm text-slate-600 mb-2">Configure the webhook:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1 text-sm text-slate-600">
                      <li><strong>URL:</strong> Paste your Thavon webhook URL</li>
                      <li><strong>Method:</strong> POST</li>
                      <li><strong>Data Pass-Through:</strong> Yes</li>
                    </ul>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center">
                    4
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">Map Required Fields</p>
                    <p className="text-sm text-slate-600 mb-2">
                      Map the following fields from your trigger app to Thavon:
                    </p>
                    <div className="bg-slate-50 p-3 rounded-lg text-sm">
                      <p className="font-medium mb-2">Required Fields:</p>
                      <ul className="list-disc list-inside ml-4 space-y-1">
                        <li><code className="bg-white px-1 rounded">name</code> or <code className="bg-white px-1 rounded">first_name</code> + <code className="bg-white px-1 rounded">last_name</code></li>
                        <li><code className="bg-white px-1 rounded">phone</code> or <code className="bg-white px-1 rounded">phone_number</code></li>
                        <li><code className="bg-white px-1 rounded">address</code> (optional but recommended)</li>
                      </ul>
                    </div>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center">
                    5
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">Test and Activate</p>
                    <p className="text-sm text-slate-600">
                      Test your Zap with a sample record. If successful, activate it. Thavon will now 
                      automatically call new leads from your connected app.
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900 mb-1">Pro Tip</p>
                  <p className="text-sm text-blue-700">
                    Thavon automatically handles field name variations. You can send <code>name</code>, 
                    <code>first_name</code>, <code>Name</code>, or <code>First Name</code> - we'll recognize it.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* HubSpot Documentation */}
        <Card id="hubspot" className="mb-8 border-none shadow-sm bg-white">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Key className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <CardTitle>HubSpot Integration</CardTitle>
                <CardDescription>Two-way sync with HubSpot CRM</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Overview</h3>
              <p className="text-slate-600 mb-4">
                Connect your HubSpot account to automatically import FSBO leads and sync call results 
                back to HubSpot. This integration uses OAuth 2.0 for secure authentication.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Setup Steps</h3>
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center">
                    1
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">Create a HubSpot Private App</p>
                    <p className="text-sm text-slate-600 mb-2">
                      In HubSpot, go to <strong>Settings → Integrations → Private Apps</strong> and create a new app.
                    </p>
                    <p className="text-sm text-slate-600 mb-2">Required scopes:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1 text-sm text-slate-600">
                      <li><code className="bg-slate-50 px-1 rounded">contacts</code></li>
                      <li><code className="bg-slate-50 px-1 rounded">crm.objects.contacts.read</code></li>
                      <li><code className="bg-slate-50 px-1 rounded">crm.objects.contacts.write</code></li>
                    </ul>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center">
                    2
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">Configure Redirect URL</p>
                    <p className="text-sm text-slate-600 mb-2">
                      In your HubSpot app settings, add this redirect URL:
                    </p>
                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded">
                      <code className="flex-1 text-xs font-mono">
                        https://app.thavon.io/api/integrations/callback/hubspot
                      </code>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => copyToClipboard("https://app.thavon.io/api/integrations/callback/hubspot", "hubspot-redirect")}
                        className="h-8 w-8"
                      >
                        {copied === "hubspot-redirect" ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center">
                    3
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">Copy Credentials</p>
                    <p className="text-sm text-slate-600">
                      Copy your <strong>Client ID</strong> and <strong>Client Secret</strong> from the HubSpot app. 
                      These need to be configured in your Thavon environment variables (contact support for help).
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center">
                    4
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">Connect in Thavon</p>
                    <p className="text-sm text-slate-600">
                      Go to the Integrations page and click <strong>"Connect HubSpot"</strong>. You'll be 
                      redirected to HubSpot to authorize the connection.
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center">
                    5
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">Sync Leads</p>
                    <p className="text-sm text-slate-600">
                      Once connected, click <strong>"Sync Leads"</strong> to import contacts from HubSpot. 
                      Call results will automatically sync back to HubSpot.
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900 mb-1">Automatic Sync</p>
                  <p className="text-sm text-green-700">
                    After the initial sync, Thavon automatically updates HubSpot contacts with call outcomes, 
                    appointment bookings, and lead status changes.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Salesforce Documentation */}
        <Card id="salesforce" className="mb-8 border-none shadow-sm bg-white">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Key className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>Salesforce Integration</CardTitle>
                <CardDescription>Import leads and sync call results</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Overview</h3>
              <p className="text-slate-600 mb-4">
                Connect Salesforce to import FSBO leads from campaigns and automatically update records 
                with call outcomes and appointment bookings.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Setup Steps</h3>
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center">
                    1
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">Create a Connected App</p>
                    <p className="text-sm text-slate-600 mb-2">
                      In Salesforce, go to <strong>Setup → App Manager → New Connected App</strong>.
                    </p>
                    <p className="text-sm text-slate-600 mb-2">Configure:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1 text-sm text-slate-600">
                      <li><strong>Callback URL:</strong> <code className="bg-slate-50 px-1 rounded">https://app.thavon.io/api/integrations/callback/salesforce</code></li>
                      <li><strong>OAuth Scopes:</strong> <code className="bg-slate-50 px-1 rounded">api</code>, <code className="bg-slate-50 px-1 rounded">refresh_token</code>, <code className="bg-slate-50 px-1 rounded">offline_access</code></li>
                    </ul>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center">
                    2
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">Copy Credentials</p>
                    <p className="text-sm text-slate-600">
                      Copy your <strong>Consumer Key (Client ID)</strong> and <strong>Consumer Secret</strong>. 
                      These need to be configured in your Thavon environment variables.
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center">
                    3
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">Connect in Thavon</p>
                    <p className="text-sm text-slate-600">
                      Go to the Integrations page and click <strong>"Connect Salesforce"</strong>. Authorize 
                      the connection when prompted.
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center">
                    4
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">Sync Leads</p>
                    <p className="text-sm text-slate-600">
                      Click <strong>"Sync Leads"</strong> to import leads from Salesforce. Thavon will 
                      sync call results back to your Salesforce records.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Pipedrive Documentation */}
        <Card id="pipedrive" className="mb-8 border-none shadow-sm bg-white">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Key className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <CardTitle>Pipedrive Integration</CardTitle>
                <CardDescription>Webhook-based integration for Pipedrive</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Overview</h3>
              <p className="text-slate-600 mb-4">
                Connect Pipedrive via webhooks to automatically call new deals and update pipeline stages 
                based on call results.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Setup Steps</h3>
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center">
                    1
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">Get Your Webhook URL</p>
                    <p className="text-sm text-slate-600">
                      Copy your webhook URL from the Integrations page. It's unique to your agency.
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center">
                    2
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">Configure Pipedrive Webhook</p>
                    <p className="text-sm text-slate-600">
                      In Pipedrive, go to <strong>Settings → Integrations → Webhooks</strong> and create 
                      a new webhook. Set it to trigger on "Deal created" or "Person added" events.
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center">
                    3
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">Map Fields</p>
                    <p className="text-sm text-slate-600">
                      Configure Pipedrive to send: <code>name</code>, <code>phone</code>, and <code>address</code> 
                      fields to your Thavon webhook URL.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Facebook Lead Ads Documentation */}
        <Card id="facebook" className="mb-8 border-none shadow-sm bg-white">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Key className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>Facebook Lead Ads</CardTitle>
                <CardDescription>Instant calls for Facebook leads</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Overview</h3>
              <p className="text-slate-600 mb-4">
                Connect Facebook Lead Ads to automatically call leads the moment they submit a form. 
                This integration uses webhooks for real-time lead delivery.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Setup Steps</h3>
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center">
                    1
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">Get Your Webhook URL</p>
                    <p className="text-sm text-slate-600">
                      Copy your webhook URL from the Integrations page.
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center">
                    2
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">Configure Facebook Webhook</p>
                    <p className="text-sm text-slate-600">
                      In Facebook Events Manager, create a webhook for your Lead Ads form. Set the endpoint 
                      to your Thavon webhook URL.
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm flex items-center justify-center">
                    3
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 mb-1">Test the Integration</p>
                    <p className="text-sm text-slate-600">
                      Submit a test lead form. Thavon should call the lead within seconds.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Troubleshooting */}
        <Card id="troubleshooting" className="mb-8 border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle>Troubleshooting</CardTitle>
            <CardDescription>Common issues and solutions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">OAuth Connection Fails</h3>
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <p className="text-sm text-slate-700"><strong>Issue:</strong> "Redirect URL doesn't match"</p>
                <p className="text-sm text-slate-700"><strong>Solution:</strong> Ensure the redirect URL in your OAuth app exactly matches: <code className="bg-white px-1 rounded">https://app.thavon.io/api/integrations/callback/[provider]</code></p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Webhook Not Receiving Data</h3>
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <p className="text-sm text-slate-700"><strong>Issue:</strong> Leads not triggering calls</p>
                <p className="text-sm text-slate-700"><strong>Solution:</strong> Verify the webhook URL is correct, check that required fields (name, phone) are being sent, and ensure your subscription is active.</p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Sync Not Working</h3>
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <p className="text-sm text-slate-700"><strong>Issue:</strong> Leads not syncing from CRM</p>
                <p className="text-sm text-slate-700"><strong>Solution:</strong> Click "Test Connection" to verify OAuth tokens are valid. If expired, disconnect and reconnect the integration.</p>
              </div>
            </div>

            <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
              <div className="flex gap-3">
                <MessageSquare className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-violet-900 mb-1">Still Need Help?</p>
                  <p className="text-sm text-violet-700 mb-3">
                    Our support team is here to help. Contact us for personalized assistance.
                  </p>
                  <Link href="/integrations/support">
                    <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
                      Contact Support
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

