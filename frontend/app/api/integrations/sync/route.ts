import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { safeDecrypt } from "@/lib/encryption";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Lead {
  name: string;
  phone: string;
  address?: string;
  email?: string;
  asking_price?: string;
  source?: string;
}

/**
 * Fetches leads from HubSpot
 */
async function fetchHubSpotLeads(accessToken: string, agencyId: string): Promise<Lead[]> {
  try {
    // Fetch contacts from HubSpot
    const response = await fetch(
      "https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,phone,email,address",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.status}`);
    }

    const data = await response.json();
    const leads: Lead[] = [];

    for (const contact of data.results || []) {
      const properties = contact.properties || {};
      const firstName = properties.firstname || "";
      const lastName = properties.lastname || "";
      const phone = properties.phone || properties.mobilephone || "";
      const email = properties.email || "";
      const address = properties.address || "";

      if (phone) {
        leads.push({
          name: `${firstName} ${lastName}`.trim() || "Unknown",
          phone: phone.replace(/\D/g, ""), // Remove non-digits
          address: address,
          email: email,
          asking_price: "0",
          source: "hubspot",
        });
      }
    }

    return leads;
  } catch (error: any) {
    console.error("HubSpot sync error:", error);
    throw error;
  }
}

/**
 * Fetches leads from Salesforce
 */
async function fetchSalesforceLeads(
  accessToken: string,
  instanceUrl: string,
  agencyId: string
): Promise<Lead[]> {
  try {
    // Query Salesforce for Leads
    const query = `SELECT Id, FirstName, LastName, Phone, Email, Address, Price__c FROM Lead WHERE Phone != null LIMIT 100`;
    const encodedQuery = encodeURIComponent(query);

    const response = await fetch(
      `${instanceUrl}/services/data/v57.0/query?q=${encodedQuery}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Salesforce API error: ${response.status}`);
    }

    const data = await response.json();
    const leads: Lead[] = [];

    for (const record of data.records || []) {
      const firstName = record.FirstName || "";
      const lastName = record.LastName || "";
      const phone = record.Phone || "";
      const email = record.Email || "";
      const address = record.Address || "";
      const price = record.Price__c || "0";

      if (phone) {
        leads.push({
          name: `${firstName} ${lastName}`.trim() || "Unknown",
          phone: phone.replace(/\D/g, ""), // Remove non-digits
          address: address,
          email: email,
          asking_price: price.toString(),
          source: "salesforce",
        });
      }
    }

    return leads;
  } catch (error: any) {
    console.error("Salesforce sync error:", error);
    throw error;
  }
}

/**
 * Saves leads to database, avoiding duplicates
 */
async function saveLeads(leads: Lead[], agencyId: string): Promise<{ saved: number; skipped: number }> {
  let saved = 0;
  let skipped = 0;

  for (const lead of leads) {
    // Check if lead already exists (by phone number)
    const { data: existing } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("phone_number", lead.phone)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    // Insert new lead
    const { error } = await supabaseAdmin.from("leads").insert({
      agency_id: agencyId,
      name: lead.name,
      phone_number: lead.phone,
      address: lead.address || "",
      asking_price: lead.asking_price || "0",
      status: "new",
      source: lead.source || "integration",
    });

    if (!error) {
      saved++;
    }
  }

  return { saved, skipped };
}

export async function POST(req: Request) {
  try {
    const { integrationId, agencyId } = await req.json();

    if (!integrationId || !agencyId) {
      return NextResponse.json(
        { error: "Integration ID and Agency ID are required" },
        { status: 400 }
      );
    }

    // Fetch integration credentials
    const { data: integration, error: fetchError } = await supabaseAdmin
      .from("agency_integrations")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("integration_id", integrationId)
      .single();

    if (fetchError || !integration) {
      return NextResponse.json(
        { error: "Integration not found or not connected" },
        { status: 404 }
      );
    }

    if (integration.status !== "connected") {
      return NextResponse.json(
        { error: "Integration is not connected" },
        { status: 400 }
      );
    }

    // Check if token is expired and refresh if needed
    const now = new Date();
    const expiresAt = integration.expires_at ? new Date(integration.expires_at) : null;
    
    if (expiresAt && expiresAt < now) {
      // Token expired - try to refresh
      const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/integrations/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId, agencyId }),
      });
      
      if (!refreshResponse.ok) {
        return NextResponse.json(
          { error: "Token expired and refresh failed. Please reconnect the integration." },
          { status: 401 }
        );
      }
      
      // Re-fetch integration with new token
      const { data: refreshedIntegration } = await supabaseAdmin
        .from("agency_integrations")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("integration_id", integrationId)
        .single();
      
      if (refreshedIntegration) {
        integration = refreshedIntegration;
      }
    }

    // Decrypt access token
    const accessToken = safeDecrypt(integration.access_token);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Failed to decrypt access token" },
        { status: 500 }
      );
    }

    let leads: Lead[] = [];

    // Fetch leads based on provider
    if (integration.provider === "hubspot") {
      leads = await fetchHubSpotLeads(accessToken, agencyId);
    } else if (integration.provider === "salesforce") {
      const instanceUrl = integration.metadata?.instance_url || "https://login.salesforce.com";
      leads = await fetchSalesforceLeads(accessToken, instanceUrl, agencyId);
    } else {
      return NextResponse.json(
        { error: "Sync not supported for this integration type" },
        { status: 400 }
      );
    }

    // Save leads to database
    const { saved, skipped } = await saveLeads(leads, agencyId);

    // Update last sync time
    await supabaseAdmin
      .from("agency_integrations")
      .update({
        last_synced_at: new Date().toISOString(),
        metadata: {
          ...integration.metadata,
          last_sync_count: saved,
          last_sync_skipped: skipped,
        },
      })
      .eq("agency_id", agencyId)
      .eq("integration_id", integrationId);

    return NextResponse.json({
      success: true,
      leadsFound: leads.length,
      leadsSaved: saved,
      leadsSkipped: skipped,
      message: `Synced ${saved} new leads from ${integration.name}`,
    });
  } catch (error: any) {
    console.error("Sync error:", error);
    return NextResponse.json(
      {
        error: error.message || "Sync failed",
        success: false,
      },
      { status: 500 }
    );
  }
}

