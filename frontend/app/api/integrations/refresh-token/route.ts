import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { safeEncrypt, safeDecrypt } from "@/lib/encryption";
import { getAuthenticatedUserAndAgency } from "@/lib/auth-helpers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Refreshes an expired OAuth token
 */
export async function POST(req: Request) {
  try {
    // SECURITY: Verify user is authenticated and get their agency
    const authData = await getAuthenticatedUserAndAgency(req);
    if (!authData) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { integrationId, agencyId } = await req.json();

    if (!integrationId || !agencyId) {
      return NextResponse.json(
        { error: "Integration ID and Agency ID are required" },
        { status: 400 }
      );
    }

    // SECURITY: Verify user owns the agency they're refreshing tokens for
    if (authData.agencyId !== agencyId) {
      return NextResponse.json(
        { error: "Access denied: You can only refresh tokens for your own agency" },
        { status: 403 }
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

    let tokenResponse;
    if (integration.provider === "hubspot") {
      tokenResponse = await fetch("https://api.hubapi.com/oauth/v1/token", {
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
    } else if (integration.provider === "salesforce") {
      tokenResponse = await fetch("https://login.salesforce.com/services/oauth2/token", {
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
    } else {
      return NextResponse.json(
        { error: "Token refresh not supported for this provider" },
        { status: 400 }
      );
    }

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token refresh failed:", errorData);
      return NextResponse.json(
        { error: "Failed to refresh token" },
        { status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();

    // Update tokens in database
    const { error: updateError } = await supabaseAdmin
      .from("agency_integrations")
      .update({
        access_token: safeEncrypt(tokenData.access_token),
        refresh_token: safeEncrypt(tokenData.refresh_token || refreshToken), // Keep old if new not provided
        expires_at: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        metadata: {
          ...integration.metadata,
          instance_url: tokenData.instance_url || integration.metadata?.instance_url,
        },
      })
      .eq("agency_id", agencyId)
      .eq("integration_id", integrationId);

    if (updateError) {
      console.error("Database update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update tokens" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Token refreshed successfully" });
  } catch (error: any) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

