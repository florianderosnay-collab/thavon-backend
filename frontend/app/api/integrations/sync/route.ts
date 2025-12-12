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
  source: string;
  metadata?: Record<string, any>;
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
      const props = contact.properties || {};
      const firstName = props.firstname || "";
      const lastName = props.lastname || "";
      const name = `${firstName} ${lastName}`.trim() || "Unknown";
      const phone = props.phone || "";
      const email = props.email || "";
      const address = props.address || "";

      if (phone) {
        leads.push({
          name,
          phone,
          address,
          email,
          source: "hubspot",
        metadata: {
          hubspot_contact_id: contact.id,
          created_at: contact.createdAt,
          properties: props,
        },
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
    const query = "SELECT Id, FirstName, LastName, Phone, Email, Address, CreatedDate FROM Lead WHERE Phone != null LIMIT 100";
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

    for (const lead of data.records || []) {
      const firstName = lead.FirstName || "";
      const lastName = lead.LastName || "";
      const name = `${firstName} ${lastName}`.trim() || "Unknown";
      const phone = lead.Phone || "";
      const email = lead.Email || "";
      const address = lead.Address ? `${lead.Address.street || ""} ${lead.Address.city || ""} ${lead.Address.state || ""}`.trim() : "";

      if (phone) {
        leads.push({
          name,
          phone,
          address,
          email,
          source: "salesforce",
          metadata: {
            salesforce_lead_id: lead.Id,
            created_at: lead.CreatedDate,
          },
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
 * Saves leads to database
 */
async function saveLeadsToDatabase(leads: Lead[], agencyId: string): Promise<number> {
  if (leads.length === 0) return 0;

  const leadData = leads.map((lead) => ({
    agency_id: agencyId,
    name: lead.name,
    phone_number: lead.phone,
    address: lead.address || "",
    email: lead.email || null,
    status: "new",
    asking_price: "0",
    source: lead.source,
    metadata: lead.metadata || {},
  }));

  // Use upsert to avoid duplicates (based on phone_number + agency_id)
  const { data, error } = await supabaseAdmin
    .from("leads")
    .upsert(leadData, {
      onConflict: "agency_id,phone_number",
      ignoreDuplicates: false,
    })
    .select();

  if (error) {
    console.error("Error saving leads:", error);
    throw error;
  }

  return data?.length || 0;
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
      // Token expired, try to refresh
      try {
        const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/integrations/refresh-token`, {
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
          Object.assign(integration, refreshedIntegration);
        }
      } catch (refreshError) {
        console.error("Token refresh error:", refreshError);
        return NextResponse.json(
          { error: "Token expired and refresh failed. Please reconnect the integration." },
          { status: 401 }
        );
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

    // Fetch leads based on provider
    let leads: Lead[] = [];
    let syncError: string | null = null;

    try {
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
    } catch (error: any) {
      syncError = error.message;
      console.error("Sync error:", error);
    }

    // Save leads to database
    let savedCount = 0;
    if (leads.length > 0 && !syncError) {
      try {
        savedCount = await saveLeadsToDatabase(leads, agencyId);
      } catch (error: any) {
        syncError = error.message;
      }
    }

    // Update last sync timestamp
    await supabaseAdmin
      .from("agency_integrations")
      .update({
        last_synced_at: new Date().toISOString(),
        metadata: {
          ...integration.metadata,
          last_sync_count: savedCount,
          last_sync_error: syncError || null,
        },
      })
      .eq("agency_id", agencyId)
      .eq("integration_id", integrationId);

    if (syncError) {
      return NextResponse.json(
        {
          success: false,
          error: syncError,
          leadsFound: leads.length,
          leadsSaved: savedCount,
          leadsSkipped: leads.length - savedCount,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      leadsFound: leads.length,
      leadsSaved: savedCount,
      leadsSkipped: leads.length - savedCount,
      message: `Successfully synced ${savedCount} leads from ${integrationId}`,
    });
  } catch (error: any) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
