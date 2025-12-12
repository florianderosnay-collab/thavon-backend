import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { safeEncrypt } from "@/lib/encryption";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/integrations?error=${error}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/integrations?error=missing_params`
      );
    }

    // Decode state to get agencyId and integrationId
    const stateData = JSON.parse(Buffer.from(state, "base64").toString());
    const { agencyId, integrationId } = stateData;

    // Exchange code for access token
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/integrations/callback/${provider}`;
    
    let tokenResponse;
    if (provider === "hubspot") {
      tokenResponse = await fetch("https://api.hubapi.com/oauth/v1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: process.env.HUBSPOT_CLIENT_ID || "",
          client_secret: process.env.HUBSPOT_CLIENT_SECRET || "",
          redirect_uri: redirectUri,
          code: code,
        }),
      });
    } else if (provider === "salesforce") {
      tokenResponse = await fetch("https://login.salesforce.com/services/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: process.env.SALESFORCE_CLIENT_ID || "",
          client_secret: process.env.SALESFORCE_CLIENT_SECRET || "",
          redirect_uri: redirectUri,
          code: code,
        }),
      });
    } else {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/integrations?error=unsupported_provider`
      );
    }

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/integrations?error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();

    // Store credentials in database (encrypted)
    const { error: dbError } = await supabaseAdmin
      .from("agency_integrations")
      .upsert({
        agency_id: agencyId,
        integration_id: integrationId,
        provider: provider,
        access_token: safeEncrypt(tokenData.access_token),
        refresh_token: safeEncrypt(tokenData.refresh_token || null),
        expires_at: tokenData.expires_in 
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        metadata: {
          token_type: tokenData.token_type,
          scope: tokenData.scope,
          // Salesforce returns instance_url in token response
          instance_url: tokenData.instance_url || (provider === "salesforce" ? tokenData.instance_url : null),
        },
        status: "connected",
        connected_at: new Date().toISOString(),
      }, {
        onConflict: "agency_id,integration_id"
      });

    if (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/integrations?error=storage_failed`
      );
    }

    // Redirect back to integrations page with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/integrations?success=${integrationId}`
    );
  } catch (error: any) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/integrations?error=callback_failed`
    );
  }
}

