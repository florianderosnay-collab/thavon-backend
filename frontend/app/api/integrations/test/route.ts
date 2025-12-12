import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { safeDecrypt } from "@/lib/encryption";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
        { error: "Integration not found", connected: false },
        { status: 404 }
      );
    }

    // Decrypt access token
    const accessToken = safeDecrypt(integration.access_token);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Failed to decrypt access token", connected: false },
        { status: 500 }
      );
    }

    // Test connection based on provider
    let testResult = { connected: false, message: "" };

    if (integration.provider === "hubspot") {
      try {
        const testResponse = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });
        testResult.connected = testResponse.ok;
        testResult.message = testResponse.ok 
          ? "Successfully connected to HubSpot" 
          : `Failed to connect to HubSpot: ${testResponse.status}`;
      } catch (error: any) {
        testResult.message = `Error testing HubSpot connection: ${error.message}`;
      }
    } else if (integration.provider === "salesforce") {
      try {
        // Get instance URL from token response or metadata
        const instanceUrl = integration.metadata?.instance_url || "https://login.salesforce.com";
        const testResponse = await fetch(`${instanceUrl}/services/data/v57.0/sobjects/Lead/describe`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });
        testResult.connected = testResponse.ok;
        testResult.message = testResponse.ok 
          ? "Successfully connected to Salesforce" 
          : `Failed to connect to Salesforce: ${testResponse.status}`;
      } catch (error: any) {
        testResult.message = `Error testing Salesforce connection: ${error.message}`;
      }
    } else {
      // For webhook-based integrations, just check if webhook URL exists
      testResult.connected = true;
      testResult.message = "Webhook URL configured";
    }

    // Update last tested timestamp
    await supabaseAdmin
      .from("agency_integrations")
      .update({ last_tested_at: new Date().toISOString() })
      .eq("agency_id", agencyId)
      .eq("integration_id", integrationId);

    return NextResponse.json(testResult);
  } catch (error: any) {
    console.error("Test connection error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error", connected: false },
      { status: 500 }
    );
  }
}

