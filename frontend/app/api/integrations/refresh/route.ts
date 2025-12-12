import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { safeEncrypt, safeDecrypt } from "@/lib/encryption";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Refreshes an expired OAuth token
 */
export async function POST(req: Request) {
  try {
    const { integrationId, agencyId } = await req.json();

    if (!integrationId || !agencyId) {
      return NextResponse.json(
        { error: "Integration ID and Agency ID are required" },
        { status: 400 }
      );
    }

    // Fetch integration with refresh token
    const { data: integration, error: fetchError } = await supabaseAdmin
      .from("agency_integrations")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("integration_id", integrationId)
      .single();

    if (fetchError || !integration) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    const refreshToken = safeDecrypt(integration.refresh_token);
    if (!refreshToken) {
      return NextResponse.json(
        { error: "No refresh token available" },
        { status: 400 }
      );
    }

    let newTokenData: any;

    // Refresh token based on provider
    if (integration.provider === "hubspot") {
      const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: process.env.HUBSPOT_CLIENT_ID || "",
          client_secret: process.env.HUBSPOT_CLIENT_SECRET || "",
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`HubSpot token refresh failed: ${response.status}`);
      }

      newTokenData = await response.json();
    } else if (integration.provider === "salesforce") {
      const response = await fetch("https://login.salesforce.com/services/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: process.env.SALESFORCE_CLIENT_ID || "",
          client_secret: process.env.SALESFORCE_CLIENT_SECRET || "",
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Salesforce token refresh failed: ${response.status}`);
      }

      newTokenData = await response.json();
    } else {
      return NextResponse.json(
        { error: "Token refresh not supported for this provider" },
        { status: 400 }
      );
    }

    // Update stored tokens
    const { error: updateError } = await supabaseAdmin
      .from("agency_integrations")
      .update({
        access_token: safeEncrypt(newTokenData.access_token),
        refresh_token: safeEncrypt(newTokenData.refresh_token || refreshToken),
        expires_at: newTokenData.expires_in
          ? new Date(Date.now() + newTokenData.expires_in * 1000).toISOString()
          : null,
        metadata: {
          ...integration.metadata,
          token_type: newTokenData.token_type,
        },
      })
      .eq("agency_id", agencyId)
      .eq("integration_id", integrationId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: "Token refreshed successfully",
    });
  } catch (error: any) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { error: error.message || "Token refresh failed" },
      { status: 500 }
    );
  }
}

