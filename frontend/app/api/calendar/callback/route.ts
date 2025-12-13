import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encrypt } from "@/lib/encryption";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Handle Google Calendar OAuth callback
 * Stores access token and refresh token for the agent
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth error
    if (error) {
      console.error("❌ OAuth error:", error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "https://app.thavon.io"}/team?error=calendar_auth_failed`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "https://app.thavon.io"}/team?error=missing_params`
      );
    }

    // Decode state to get agent_id and agency_id
    let stateData: { agent_id: string; agency_id: string };
    try {
      stateData = JSON.parse(Buffer.from(state, "base64").toString());
    } catch {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "https://app.thavon.io"}/team?error=invalid_state`
      );
    }

    const { agent_id: agentId, agency_id: agencyId } = stateData;

    // Exchange code for tokens
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || "https://app.thavon.io"}/api/calendar/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "https://app.thavon.io"}/team?error=not_configured`
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("❌ Token exchange error:", error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "https://app.thavon.io"}/team?error=token_exchange_failed`
      );
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    if (!access_token) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "https://app.thavon.io"}/team?error=no_access_token`
      );
    }

    // Get user's calendar ID (primary calendar)
    const calendarResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList/primary",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    let calendarId = "primary";
    if (calendarResponse.ok) {
      const calendarData = await calendarResponse.json();
      calendarId = calendarData.id || "primary";
    }

    // Calculate expiration time
    const expiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null;

    // Encrypt and store tokens
    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null;

    // Update agent record
    const { error: updateError } = await supabaseAdmin
      .from("agents")
      .update({
        google_calendar_id: calendarId,
        google_calendar_access_token: encryptedAccessToken,
        google_calendar_refresh_token: encryptedRefreshToken,
        google_calendar_expires_at: expiresAt,
        calendar_sync_enabled: true,
      })
      .eq("id", agentId)
      .eq("agency_id", agencyId);

    if (updateError) {
      console.error("❌ Error updating agent:", updateError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL || "https://app.thavon.io"}/team?error=update_failed`
      );
    }

    // Success! Redirect back to team page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL || "https://app.thavon.io"}/team?success=calendar_connected`
    );
  } catch (error: any) {
    console.error("❌ Calendar callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL || "https://app.thavon.io"}/team?error=internal_error`
    );
  }
}


